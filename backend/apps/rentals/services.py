from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.pricing.services import find_bonus_zone, get_current_coefficient

from .models import Booking, Car, Trip, WalletTransaction


BOOKING_TTL_MINUTES = 15


def ensure_user_can_use_service(user) -> None:
    if not user.can_use_service:
        raise serializers.ValidationError("Доступ к сервису еще не открыт администратором")


def ensure_user_has_no_debt(user) -> None:
    if user.balance < 0:
        raise serializers.ValidationError("Сначала погасите задолженность в кошельке")


@transaction.atomic
def expire_stale_bookings() -> int:
    now = timezone.now()
    cutoff = now - timedelta(minutes=BOOKING_TTL_MINUTES)
    stale_bookings = list(
        Booking.objects.select_related("car").filter(
            status=Booking.Status.ACTIVE,
            created_at__lt=cutoff,
        )
    )

    if not stale_bookings:
        return 0

    expired_car_ids: set[int] = set()
    for booking in stale_bookings:
        booking.status = Booking.Status.CANCELLED
        booking.closed_at = now
        booking.save(update_fields=["status", "closed_at"])
        expired_car_ids.add(booking.car_id)

    if expired_car_ids:
        Car.objects.filter(id__in=expired_car_ids, status=Car.Status.BOOKED).update(
            status=Car.Status.AVAILABLE
        )

    return len(stale_bookings)


@transaction.atomic
def create_booking(user, car: Car) -> Booking:
    ensure_user_can_use_service(user)
    ensure_user_has_no_debt(user)
    expire_stale_bookings()

    if Booking.objects.filter(user=user, status=Booking.Status.ACTIVE).exists():
        raise serializers.ValidationError("У вас уже есть активное бронирование")
    if Trip.objects.filter(user=user, status=Trip.Status.ACTIVE).exists():
        raise serializers.ValidationError("У вас уже есть активная поездка")
    if car.status != Car.Status.AVAILABLE:
        raise serializers.ValidationError("Автомобиль сейчас недоступен")

    car.status = Car.Status.BOOKED
    car.save(update_fields=["status"])
    return Booking.objects.create(user=user, car=car)


@transaction.atomic
def cancel_booking(booking: Booking) -> Booking:
    if booking.status != Booking.Status.ACTIVE:
        raise serializers.ValidationError("Бронирование уже неактивно")

    booking.status = Booking.Status.CANCELLED
    booking.closed_at = timezone.now()
    booking.save(update_fields=["status", "closed_at"])

    if booking.car.status == Car.Status.BOOKED:
        booking.car.status = Car.Status.AVAILABLE
        booking.car.save(update_fields=["status"])

    return booking


@transaction.atomic
def start_trip(user, car: Car, latitude, longitude) -> Trip:
    ensure_user_can_use_service(user)
    ensure_user_has_no_debt(user)
    expire_stale_bookings()

    if Trip.objects.filter(user=user, status=Trip.Status.ACTIVE).exists():
        raise serializers.ValidationError("У вас уже есть активная поездка")

    other_booking = Booking.objects.filter(user=user, status=Booking.Status.ACTIVE).exclude(car=car).first()
    if other_booking is not None:
        raise serializers.ValidationError("Сначала отмените текущую бронь или начните поездку на забронированной машине")

    booking = Booking.objects.filter(user=user, car=car, status=Booking.Status.ACTIVE).first()
    if car.status == Car.Status.BOOKED and booking is None:
        raise serializers.ValidationError("Автомобиль забронирован другим пользователем")
    if car.status not in [Car.Status.AVAILABLE, Car.Status.BOOKED]:
        raise serializers.ValidationError("Автомобиль сейчас недоступен")

    if booking is not None:
        booking.status = Booking.Status.COMPLETED
        booking.closed_at = timezone.now()
        booking.save(update_fields=["status", "closed_at"])

    car.status = Car.Status.IN_TRIP
    car.save(update_fields=["status"])

    return Trip.objects.create(
        user=user,
        car=car,
        booking=booking,
        start_latitude=latitude,
        start_longitude=longitude,
        price_per_minute=car.price_per_minute,
        coefficient=get_current_coefficient(),
    )


@transaction.atomic
def set_trip_destination(trip: Trip, latitude, longitude) -> Trip:
    if trip.status != Trip.Status.ACTIVE:
        raise serializers.ValidationError("Поездка уже завершена")

    trip.destination_latitude = latitude
    trip.destination_longitude = longitude
    trip.save(update_fields=["destination_latitude", "destination_longitude"])
    return trip


@transaction.atomic
def finish_trip(trip: Trip, latitude, longitude, route_duration_minutes=None) -> Trip:
    if trip.status != Trip.Status.ACTIVE:
        raise serializers.ValidationError("Поездка уже завершена")

    finished_at = timezone.now()
    if route_duration_minutes is not None:
        total_minutes = max(1, int(route_duration_minutes))
        total_price = (
            Decimal(total_minutes) * trip.price_per_minute * trip.coefficient
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    else:
        total_price = trip.calculate_price(finished_at)
        seconds = max(60, int((finished_at - trip.started_at).total_seconds()))
        total_minutes = (seconds + 59) // 60

    bonus_zone = find_bonus_zone(latitude, longitude)
    discount_percent = bonus_zone.discount_percent if bonus_zone is not None else Decimal("0.00")
    if discount_percent > 0:
        discount_multiplier = (Decimal("100.00") - discount_percent) / Decimal("100.00")
        total_price = (total_price * discount_multiplier).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    trip.status = Trip.Status.COMPLETED
    trip.finished_at = finished_at
    trip.end_latitude = latitude
    trip.end_longitude = longitude
    trip.bonus_zone = bonus_zone
    trip.discount_percent = discount_percent
    trip.total_minutes = total_minutes
    trip.total_price = total_price
    trip.save()

    trip.user.balance -= total_price
    trip.user.save(update_fields=["balance"])

    trip.car.status = Car.Status.AVAILABLE
    trip.car.latitude = latitude
    trip.car.longitude = longitude
    trip.car.save(update_fields=["status", "latitude", "longitude"])

    WalletTransaction.objects.create(
        user=trip.user,
        transaction_type=WalletTransaction.Type.TRIP_PAYMENT,
        amount=-total_price,
        description=f"Поездка на {trip.car}",
    )

    return trip


@transaction.atomic
def top_up_wallet(user, amount: Decimal) -> WalletTransaction:
    if amount <= 0:
        raise serializers.ValidationError("Сумма пополнения должна быть больше нуля")

    user.balance += amount
    user.save(update_fields=["balance"])

    return WalletTransaction.objects.create(
        user=user,
        transaction_type=WalletTransaction.Type.TOP_UP,
        amount=amount,
        description="Пополнение кошелька",
    )
