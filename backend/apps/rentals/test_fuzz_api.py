from copy import deepcopy
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .models import BonusZone, Car, Tariff, TimeCoefficient, WalletTransaction


User = get_user_model()


class _MissingValue:
    pass


_MISSING = _MissingValue()


def build_payload(base_payload, overrides):
    payload = deepcopy(base_payload)
    for field, value in overrides.items():
        if value is _MISSING:
            payload.pop(field, None)
        else:
            payload[field] = value
    return payload


class AuthInputFuzzAPITests(APITestCase):
    register_url = "/api/auth/register/"
    login_url = "/api/auth/login/"

    def setUp(self):
        self.valid_register_payload = {
            "email": "driver@example.com",
            "password": "StrongPass123",
            "password_confirm": "StrongPass123",
            "first_name": "Anna",
            "last_name": "Ivanova",
            "patronymic": "Sergeevna",
            "phone": "79990001122",
            "driver_license_number": "1234123456",
        }

    def test_registration_rejects_fuzzed_invalid_input(self):
        cases = (
            ("missing_email", {"email": _MISSING}),
            ("blank_email", {"email": ""}),
            ("spaces_email", {"email": "   "}),
            ("email_without_at", {"email": "driver.example.com"}),
            ("email_without_domain", {"email": "driver@"}),
            ("xss_email", {"email": "<script>alert(1)</script>@example.com"}),
            ("very_long_email", {"email": f"{'a' * 260}@example.com"}),
            ("none_email", {"email": None}),
            ("list_email", {"email": ["driver@example.com"]}),
            ("missing_password", {"password": _MISSING}),
            ("blank_password", {"password": "", "password_confirm": ""}),
            ("space_password", {"password": "   ", "password_confirm": "   "}),
            ("missing_password_confirm", {"password_confirm": _MISSING}),
            ("password_mismatch", {"password_confirm": "OtherPass123"}),
            ("missing_first_name", {"first_name": _MISSING}),
            ("blank_first_name", {"first_name": ""}),
            ("digits_in_first_name", {"first_name": "Anna1"}),
            ("symbols_in_first_name", {"first_name": "Ann@"}),
            ("xss_first_name", {"first_name": "<script>alert(1)</script>"}),
            ("emoji_first_name", {"first_name": "Anna🙂"}),
            ("none_first_name", {"first_name": None}),
            ("blank_last_name", {"last_name": ""}),
            ("sql_like_last_name", {"last_name": "' OR 1=1 --"}),
            ("blank_patronymic", {"patronymic": ""}),
            ("punctuation_patronymic", {"patronymic": "Sergeevna!"}),
            ("missing_phone", {"phone": _MISSING}),
            ("blank_phone", {"phone": ""}),
            ("short_phone", {"phone": "123"}),
            ("long_phone", {"phone": "799900011223"}),
            ("plus_phone", {"phone": "+79990001122"}),
            ("letters_phone", {"phone": "7999000ABCD"}),
            ("sql_like_phone", {"phone": "79990001122 OR 1=1"}),
            ("none_phone", {"phone": None}),
            ("missing_license", {"driver_license_number": _MISSING}),
            ("blank_license", {"driver_license_number": ""}),
            ("short_license", {"driver_license_number": "12345"}),
            ("long_license", {"driver_license_number": "12341234567"}),
            ("bad_series_mix", {"driver_license_number": "1A2B123456"}),
            ("letters_in_number", {"driver_license_number": "12AB12CD56"}),
            ("path_traversal_license", {"driver_license_number": "../../etc/passwd"}),
            ("dict_license", {"driver_license_number": {"number": "1234123456"}}),
        )

        for name, overrides in cases:
            with self.subTest(name=name):
                payload = build_payload(self.valid_register_payload, overrides)
                before_count = User.objects.count()
                response = self.client.post(self.register_url, payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(User.objects.count(), before_count)

    def test_login_rejects_fuzzed_invalid_input(self):
        User.objects.create_user(
            username="driver",
            email="driver@example.com",
            password="StrongPass123",
            verification_status=User.VerificationStatus.APPROVED,
        )
        cases = (
            ("missing_email", {"password": "StrongPass123"}),
            ("blank_email", {"email": "", "password": "StrongPass123"}),
            ("spaces_email", {"email": "   ", "password": "StrongPass123"}),
            ("bad_email", {"email": "driver", "password": "StrongPass123"}),
            ("xss_email", {"email": "<img src=x onerror=alert(1)>", "password": "StrongPass123"}),
            ("unknown_email", {"email": "missing@example.com", "password": "StrongPass123"}),
            ("none_email", {"email": None, "password": "StrongPass123"}),
            ("missing_password", {"email": "driver@example.com"}),
            ("blank_password", {"email": "driver@example.com", "password": ""}),
            ("wrong_password", {"email": "driver@example.com", "password": "WrongPass123"}),
            ("none_password", {"email": "driver@example.com", "password": None}),
            ("list_password", {"email": "driver@example.com", "password": ["StrongPass123"]}),
        )

        for name, payload in cases:
            with self.subTest(name=name):
                response = self.client.post(self.login_url, payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertNotIn("token", response.data)


class AdminAndWalletInputFuzzAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="driver",
            email="driver@example.com",
            password="StrongPass123",
            verification_status=User.VerificationStatus.APPROVED,
            balance=Decimal("100.00"),
        )
        self.user_token = Token.objects.create(user=self.user)
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@example.com",
            password="AdminPass123",
            role=User.Role.ADMIN,
            verification_status=User.VerificationStatus.APPROVED,
            is_staff=True,
            is_superuser=True,
        )
        self.admin_token = Token.objects.create(user=self.admin)
        Tariff.objects.create(
            pk=1,
            name="Base",
            price_per_minute=Decimal("10.00"),
            min_start_balance=Decimal("100.00"),
        )
        self.coefficient = TimeCoefficient.objects.create(
            name="Day",
            start_time="00:00",
            end_time="23:59",
            coefficient=Decimal("1.00"),
        )

    def authorize_user(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.user_token.key}")

    def authorize_admin(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {self.admin_token.key}")

    def test_wallet_top_up_rejects_fuzzed_invalid_amounts(self):
        self.authorize_user()
        cases = (
            ("missing_amount", {}),
            ("blank_amount", {"amount": ""}),
            ("zero", {"amount": "0"}),
            ("less_than_minimum", {"amount": "0.99"}),
            ("negative", {"amount": "-1.00"}),
            ("text", {"amount": "abc"}),
            ("sql_like", {"amount": "1 OR 1=1"}),
            ("too_many_decimal_places", {"amount": "10.999"}),
            ("too_many_digits", {"amount": "12345678901.00"}),
            ("none", {"amount": None}),
            ("list", {"amount": ["100.00"]}),
        )

        for name, payload in cases:
            with self.subTest(name=name):
                self.user.refresh_from_db()
                balance_before = self.user.balance
                transactions_before = WalletTransaction.objects.count()
                response = self.client.post("/api/wallet/top-up/", payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.user.refresh_from_db()
                self.assertEqual(self.user.balance, balance_before)
                self.assertEqual(WalletTransaction.objects.count(), transactions_before)

    def test_admin_car_form_rejects_fuzzed_invalid_input(self):
        self.authorize_admin()
        valid_payload = {
            "brand": "Haval",
            "model": "Jolion",
            "license_plate": "A123BC777",
            "latitude": "55.751244",
            "longitude": "37.618423",
            "price_per_minute": "12.00",
        }
        cases = (
            ("missing_brand", {"brand": _MISSING}),
            ("blank_brand", {"brand": ""}),
            ("too_long_brand", {"brand": "A" * 81}),
            ("missing_model", {"model": _MISSING}),
            ("blank_model", {"model": ""}),
            ("too_long_model", {"model": "M" * 81}),
            ("missing_license", {"license_plate": _MISSING}),
            ("blank_license", {"license_plate": ""}),
            ("bad_license_letters", {"license_plate": "Q123ZZ77"}),
            ("bad_license_short", {"license_plate": "A12BC77"}),
            ("sql_like_license", {"license_plate": "A123BC77 OR 1=1"}),
            ("missing_latitude", {"latitude": _MISSING}),
            ("missing_longitude", {"longitude": _MISSING}),
            ("text_latitude", {"latitude": "north"}),
            ("text_longitude", {"longitude": "east"}),
            ("outside_mkad", {"latitude": "59.939095", "longitude": "30.315868"}),
            ("negative_price", {"price_per_minute": "-1.00"}),
            ("zero_price", {"price_per_minute": "0.00"}),
            ("text_price", {"price_per_minute": "free"}),
            ("too_many_price_digits", {"price_per_minute": "123456789.00"}),
            ("none_price", {"price_per_minute": None}),
        )

        for name, overrides in cases:
            with self.subTest(name=name):
                payload = build_payload(valid_payload, overrides)
                before_count = Car.objects.count()
                response = self.client.post("/api/admin/cars/", payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(Car.objects.count(), before_count)

    def test_admin_tariff_form_rejects_fuzzed_invalid_input(self):
        self.authorize_admin()
        cases = (
            ("blank_name", {"name": ""}),
            ("too_long_name", {"name": "T" * 81}),
            ("negative_price", {"price_per_minute": "-1.00"}),
            ("zero_price", {"price_per_minute": "0.00"}),
            ("text_price", {"price_per_minute": "cheap"}),
            ("negative_min_balance", {"min_start_balance": "-1.00"}),
            ("text_min_balance", {"min_start_balance": "many"}),
            ("too_many_min_balance_digits", {"min_start_balance": "12345678901.00"}),
        )

        tariff = Tariff.objects.get(pk=1)
        for name, payload in cases:
            with self.subTest(name=name):
                tariff.refresh_from_db()
                before = (tariff.name, tariff.price_per_minute, tariff.min_start_balance)
                response = self.client.patch("/api/admin/tariff/", payload, format="json")
                self.assertEqual(response.status_code, 400)
                tariff.refresh_from_db()
                self.assertEqual(before, (tariff.name, tariff.price_per_minute, tariff.min_start_balance))

    def test_admin_time_coefficient_form_rejects_fuzzed_invalid_input(self):
        self.authorize_admin()
        cases = (
            ("blank_name", {"name": ""}),
            ("too_long_name", {"name": "Peak" * 30}),
            ("bad_start_time", {"start_time": "25:00"}),
            ("bad_end_time", {"end_time": "24:60"}),
            ("negative_coefficient", {"coefficient": "-1.00"}),
            ("zero_coefficient", {"coefficient": "0.00"}),
            ("too_large_coefficient", {"coefficient": "9.01"}),
            ("text_coefficient", {"coefficient": "high"}),
            ("too_many_decimal_places", {"coefficient": "1.999"}),
        )

        for name, payload in cases:
            with self.subTest(name=name):
                self.coefficient.refresh_from_db()
                before = (
                    self.coefficient.name,
                    self.coefficient.start_time,
                    self.coefficient.end_time,
                    self.coefficient.coefficient,
                )
                response = self.client.patch(
                    f"/api/admin/coefficients/{self.coefficient.id}/",
                    payload,
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
                self.coefficient.refresh_from_db()
                self.assertEqual(
                    before,
                    (
                        self.coefficient.name,
                        self.coefficient.start_time,
                        self.coefficient.end_time,
                        self.coefficient.coefficient,
                    ),
                )

    def test_admin_bonus_zone_form_rejects_fuzzed_invalid_input(self):
        self.authorize_admin()
        valid_payload = {
            "name": "Bonus zone",
            "latitude": "55.751244",
            "longitude": "37.618423",
            "radius_meters": 600,
            "discount_percent": "10.00",
            "is_active": True,
        }
        cases = (
            ("missing_name", {"name": _MISSING}),
            ("blank_name", {"name": ""}),
            ("too_long_name", {"name": "Z" * 121}),
            ("missing_latitude", {"latitude": _MISSING}),
            ("missing_longitude", {"longitude": _MISSING}),
            ("text_latitude", {"latitude": "north"}),
            ("text_longitude", {"longitude": "east"}),
            ("outside_mkad", {"latitude": "59.939095", "longitude": "30.315868"}),
            ("too_small_radius", {"radius_meters": 49}),
            ("zero_radius", {"radius_meters": 0}),
            ("negative_radius", {"radius_meters": -1}),
            ("too_large_radius", {"radius_meters": 5001}),
            ("text_radius", {"radius_meters": "wide"}),
            ("negative_discount", {"discount_percent": "-1.00"}),
            ("too_large_discount", {"discount_percent": "100.01"}),
            ("text_discount", {"discount_percent": "sale"}),
            ("bad_is_active", {"is_active": "definitely"}),
        )

        for name, overrides in cases:
            with self.subTest(name=name):
                payload = build_payload(valid_payload, overrides)
                before_count = BonusZone.objects.count()
                response = self.client.post("/api/admin/bonus-zones/", payload, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(BonusZone.objects.count(), before_count)
