from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.contrib.auth import get_user_model
from django.utils import timezone
from hypothesis import HealthCheck, given
from hypothesis.extra.django import TestCase as HypothesisTestCase
from hypothesis import settings as hypothesis_settings
from hypothesis import strategies as st
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from .models import Booking, BonusZone, Car, Tariff, TimeCoefficient, Trip, WalletTransaction


User = get_user_model()

FUZZ_SETTINGS = hypothesis_settings(
    max_examples=30,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)

MOSCOW_LATITUDE = Decimal("55.751244")
MOSCOW_LONGITUDE = Decimal("37.618423")


def decimal_strings(min_value, max_value, places=2):
    return st.decimals(
        min_value=Decimal(min_value),
        max_value=Decimal(max_value),
        places=places,
        allow_nan=False,
        allow_infinity=False,
    ).map(str)


def outside_mkad_coordinates():
    return st.one_of(
        st.tuples(decimal_strings("10.000000", "40.000000", places=6), decimal_strings("10.000000", "40.000000", places=6)),
        st.tuples(decimal_strings("70.000000", "80.000000", places=6), decimal_strings("10.000000", "40.000000", places=6)),
    )


def create_user_client(balance=Decimal("1000.00")):
    user = User.objects.create_user(
        username="driver",
        email="driver@example.com",
        password="StrongPass123",
        verification_status=User.VerificationStatus.APPROVED,
        balance=balance,
    )
    token = Token.objects.create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client, user


def create_admin_client():
    admin = User.objects.create_user(
        username="admin",
        email="admin@example.com",
        password="AdminPass123",
        role=User.Role.ADMIN,
        verification_status=User.VerificationStatus.APPROVED,
        is_staff=True,
        is_superuser=True,
    )
    token = Token.objects.create(user=admin)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return client, admin


def create_available_car(**overrides):
    payload = {
        "brand": "Haval",
        "model": "Jolion",
        "license_plate": "A123BC777",
        "latitude": MOSCOW_LATITUDE,
        "longitude": MOSCOW_LONGITUDE,
        "price_per_minute": Decimal("12.00"),
    }
    payload.update(overrides)
    return Car.objects.create(**payload)


class TripPriceHypothesisTests(HypothesisTestCase):
    @FUZZ_SETTINGS
    @given(
        duration_seconds=st.integers(min_value=0, max_value=24 * 60 * 60),
        price_per_minute=st.decimals(
            min_value=Decimal("1.00"),
            max_value=Decimal("200.00"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
        coefficient=st.decimals(
            min_value=Decimal("0.10"),
            max_value=Decimal("5.00"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        ),
    )
    def test_trip_price_uses_full_minutes_and_is_never_less_than_one_minute(
        self,
        duration_seconds,
        price_per_minute,
        coefficient,
    ):
        started_at = timezone.now()
        finished_at = started_at + timedelta(seconds=duration_seconds)
        expected_minutes = max(1, (duration_seconds + 59) // 60)
        expected_price = (
            Decimal(expected_minutes) * price_per_minute * coefficient
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        trip = Trip(
            started_at=started_at,
            price_per_minute=price_per_minute,
            coefficient=coefficient,
        )

        self.assertEqual(trip.calculate_price(finished_at), expected_price)


class WalletHypothesisTests(HypothesisTestCase):
    @FUZZ_SETTINGS
    @given(
        amount=st.decimals(
            min_value=Decimal("-10000.00"),
            max_value=Decimal("0.99"),
            places=2,
            allow_nan=False,
            allow_infinity=False,
        )
    )
    def test_wallet_top_up_rejects_generated_invalid_amounts(self, amount):
        client = APIClient()
        user = User.objects.create_user(
            username="driver",
            email="driver@example.com",
            password="StrongPass123",
            verification_status=User.VerificationStatus.APPROVED,
            balance=Decimal("100.00"),
        )
        token = Token.objects.create(user=user)
        client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
        balance_before = user.balance
        transactions_before = WalletTransaction.objects.count()

        response = client.post(
            "/api/wallet/top-up/",
            {"amount": str(amount)},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.balance, balance_before)
        self.assertEqual(WalletTransaction.objects.count(), transactions_before)

    @FUZZ_SETTINGS
    @given(amount=decimal_strings("1.00", "10000.00"))
    def test_wallet_top_up_accepts_generated_valid_amounts(self, amount):
        client, user = create_user_client(balance=Decimal("100.00"))
        balance_before = user.balance
        transactions_before = WalletTransaction.objects.count()

        response = client.post(
            "/api/wallet/top-up/",
            {"amount": amount},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        user.refresh_from_db()
        self.assertEqual(user.balance, balance_before + Decimal(amount))
        self.assertEqual(WalletTransaction.objects.count(), transactions_before + 1)


class BookingHypothesisAPITests(HypothesisTestCase):
    @FUZZ_SETTINGS
    @given(car_id=st.integers(min_value=-10000, max_value=0))
    def test_booking_rejects_generated_invalid_car_ids(self, car_id):
        client, _ = create_user_client()

        response = client.post("/api/bookings/", {"car_id": car_id}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Booking.objects.count(), 0)

    @FUZZ_SETTINGS
    @given(latitude=decimal_strings("55.700000", "55.800000", places=6), longitude=decimal_strings("37.550000", "37.700000", places=6))
    def test_trip_start_accepts_generated_valid_moscow_coordinates(self, latitude, longitude):
        client, _ = create_user_client()
        car = create_available_car()

        response = client.post(
            "/api/trips/start/",
            {"car_id": car.id, "latitude": latitude, "longitude": longitude},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        car.refresh_from_db()
        self.assertEqual(Trip.objects.count(), 1)
        self.assertEqual(car.status, Car.Status.IN_TRIP)


class TripHypothesisAPITests(HypothesisTestCase):
    def create_active_trip(self):
        client, user = create_user_client()
        car = create_available_car()
        trip = Trip.objects.create(
            user=user,
            car=car,
            start_latitude=MOSCOW_LATITUDE,
            start_longitude=MOSCOW_LONGITUDE,
            price_per_minute=Decimal("12.00"),
            coefficient=Decimal("1.00"),
        )
        car.status = Car.Status.IN_TRIP
        car.save(update_fields=["status"])
        return client, user, car, trip

    @FUZZ_SETTINGS
    @given(coords=outside_mkad_coordinates())
    def test_trip_start_rejects_generated_coordinates_outside_mkad(self, coords):
        latitude, longitude = coords
        client, _ = create_user_client()
        car = create_available_car()

        response = client.post(
            "/api/trips/start/",
            {"car_id": car.id, "latitude": latitude, "longitude": longitude},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Trip.objects.count(), 0)
        car.refresh_from_db()
        self.assertEqual(car.status, Car.Status.AVAILABLE)

    @FUZZ_SETTINGS
    @given(coords=outside_mkad_coordinates())
    def test_trip_destination_rejects_generated_coordinates_outside_mkad(self, coords):
        latitude, longitude = coords
        client, _, _, trip = self.create_active_trip()

        response = client.post(
            f"/api/trips/{trip.id}/destination/",
            {"latitude": latitude, "longitude": longitude},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        trip.refresh_from_db()
        self.assertIsNone(trip.destination_latitude)
        self.assertIsNone(trip.destination_longitude)

    @FUZZ_SETTINGS
    @given(route_duration_minutes=st.integers(min_value=-10000, max_value=0))
    def test_trip_finish_rejects_generated_invalid_route_duration(self, route_duration_minutes):
        client, user, car, trip = self.create_active_trip()
        balance_before = user.balance

        response = client.post(
            f"/api/trips/{trip.id}/finish/",
            {
                "latitude": str(MOSCOW_LATITUDE),
                "longitude": str(MOSCOW_LONGITUDE),
                "route_duration_minutes": route_duration_minutes,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        trip.refresh_from_db()
        user.refresh_from_db()
        car.refresh_from_db()
        self.assertEqual(trip.status, Trip.Status.ACTIVE)
        self.assertEqual(user.balance, balance_before)
        self.assertEqual(car.status, Car.Status.IN_TRIP)

    @FUZZ_SETTINGS
    @given(route_duration_minutes=st.integers(min_value=1, max_value=360))
    def test_trip_finish_accepts_generated_valid_route_duration(self, route_duration_minutes):
        client, user, car, trip = self.create_active_trip()
        expected_price = Decimal(route_duration_minutes) * trip.price_per_minute * trip.coefficient

        response = client.post(
            f"/api/trips/{trip.id}/finish/",
            {
                "latitude": str(MOSCOW_LATITUDE),
                "longitude": str(MOSCOW_LONGITUDE),
                "route_duration_minutes": route_duration_minutes,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        trip.refresh_from_db()
        user.refresh_from_db()
        car.refresh_from_db()
        self.assertEqual(trip.status, Trip.Status.COMPLETED)
        self.assertEqual(trip.total_minutes, route_duration_minutes)
        self.assertEqual(trip.total_price, expected_price)
        self.assertEqual(user.balance, Decimal("1000.00") - expected_price)
        self.assertEqual(car.status, Car.Status.AVAILABLE)


class AdminHypothesisAPITests(HypothesisTestCase):
    @FUZZ_SETTINGS
    @given(price_per_minute=decimal_strings("-1000.00", "0.00"))
    def test_admin_car_create_rejects_generated_invalid_prices(self, price_per_minute):
        client, _ = create_admin_client()

        response = client.post(
            "/api/admin/cars/",
            {
                "brand": "Haval",
                "model": "Jolion",
                "license_plate": "A123BC777",
                "latitude": str(MOSCOW_LATITUDE),
                "longitude": str(MOSCOW_LONGITUDE),
                "price_per_minute": price_per_minute,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Car.objects.count(), 0)

    @FUZZ_SETTINGS
    @given(coords=outside_mkad_coordinates())
    def test_admin_car_create_rejects_generated_coordinates_outside_mkad(self, coords):
        latitude, longitude = coords
        client, _ = create_admin_client()

        response = client.post(
            "/api/admin/cars/",
            {
                "brand": "Haval",
                "model": "Jolion",
                "license_plate": "A123BC777",
                "latitude": latitude,
                "longitude": longitude,
                "price_per_minute": "12.00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Car.objects.count(), 0)

    @FUZZ_SETTINGS
    @given(amount=decimal_strings("-1000.00", "-0.01"))
    def test_admin_tariff_rejects_generated_negative_min_balance(self, amount):
        client, _ = create_admin_client()
        tariff = Tariff.objects.create(
            pk=1,
            name="Base",
            price_per_minute=Decimal("10.00"),
            min_start_balance=Decimal("100.00"),
        )

        response = client.patch(
            "/api/admin/tariff/",
            {"min_start_balance": amount},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        tariff.refresh_from_db()
        self.assertEqual(tariff.min_start_balance, Decimal("100.00"))

    @FUZZ_SETTINGS
    @given(coefficient=st.one_of(decimal_strings("-10.00", "0.00"), decimal_strings("9.01", "100.00")))
    def test_admin_coefficient_rejects_generated_invalid_values(self, coefficient):
        client, _ = create_admin_client()
        time_coefficient = TimeCoefficient.objects.create(
            name="Day",
            start_time="00:00",
            end_time="23:59",
            coefficient=Decimal("1.00"),
        )

        response = client.patch(
            f"/api/admin/coefficients/{time_coefficient.id}/",
            {"coefficient": coefficient},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        time_coefficient.refresh_from_db()
        self.assertEqual(time_coefficient.coefficient, Decimal("1.00"))

    @FUZZ_SETTINGS
    @given(radius_meters=st.one_of(st.integers(min_value=-1000, max_value=49), st.integers(min_value=5001, max_value=100000)))
    def test_admin_bonus_zone_rejects_generated_invalid_radius(self, radius_meters):
        client, _ = create_admin_client()

        response = client.post(
            "/api/admin/bonus-zones/",
            {
                "name": "Bonus zone",
                "latitude": str(MOSCOW_LATITUDE),
                "longitude": str(MOSCOW_LONGITUDE),
                "radius_meters": radius_meters,
                "discount_percent": "10.00",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(BonusZone.objects.count(), 0)
