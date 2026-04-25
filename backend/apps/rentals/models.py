from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Car(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Доступен"
        BOOKED = "booked", "Забронирован"
        IN_TRIP = "in_trip", "В поездке"
        SERVICE = "service", "На обслуживании"
        INACTIVE = "inactive", "Неактивен"

    brand = models.CharField(max_length=80)
    model = models.CharField(max_length=80)
    license_plate = models.CharField(max_length=16, unique=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.AVAILABLE)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    price_per_minute = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("10.00"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["brand", "model", "license_plate"]

    def __str__(self) -> str:
        return f"{self.brand} {self.model} {self.license_plate}"


class Tariff(models.Model):
    name = models.CharField(max_length=80, default="Базовый")
    price_per_minute = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("8.00"))
    min_start_balance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("100.00"))

    def __str__(self) -> str:
        return self.name


class TimeCoefficient(models.Model):
    name = models.CharField(max_length=80)
    start_time = models.TimeField()
    end_time = models.TimeField()
    coefficient = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("1.00"))

    class Meta:
        ordering = ["start_time"]

    def __str__(self) -> str:
        return self.name

    def contains(self, current_time) -> bool:
        if self.start_time <= self.end_time:
            return self.start_time <= current_time < self.end_time
        return current_time >= self.start_time or current_time < self.end_time


class Booking(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Активна"
        CANCELLED = "cancelled", "Отменена"
        COMPLETED = "completed", "Завершена"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings")
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name="bookings")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(status="active"),
                name="one_active_booking_per_user",
            ),
            models.UniqueConstraint(
                fields=["car"],
                condition=Q(status="active"),
                name="one_active_booking_per_car",
            ),
        ]


class Trip(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Активна"
        COMPLETED = "completed", "Завершена"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trips")
    car = models.ForeignKey(Car, on_delete=models.CASCADE, related_name="trips")
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name="trips")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    start_latitude = models.DecimalField(max_digits=9, decimal_places=6)
    start_longitude = models.DecimalField(max_digits=9, decimal_places=6)
    destination_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    destination_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    end_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    end_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    price_per_minute = models.DecimalField(max_digits=8, decimal_places=2)
    coefficient = models.DecimalField(max_digits=4, decimal_places=2, default=Decimal("1.00"))
    total_minutes = models.PositiveIntegerField(default=0)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))

    class Meta:
        ordering = ["-started_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user"],
                condition=Q(status="active"),
                name="one_active_trip_per_user",
            ),
            models.UniqueConstraint(
                fields=["car"],
                condition=Q(status="active"),
                name="one_active_trip_per_car",
            ),
        ]

    def calculate_price(self, finished_at=None) -> Decimal:
        finished_at = finished_at or timezone.now()
        seconds = max(60, int((finished_at - self.started_at).total_seconds()))
        minutes = (seconds + 59) // 60
        total = Decimal(minutes) * self.price_per_minute * self.coefficient
        return total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class WalletTransaction(models.Model):
    class Type(models.TextChoices):
        TOP_UP = "top_up", "Пополнение"
        TRIP_PAYMENT = "trip_payment", "Списание за поездку"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet_transactions")
    transaction_type = models.CharField(max_length=24, choices=Type.choices)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
