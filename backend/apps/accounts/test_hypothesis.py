from copy import deepcopy

from django.contrib.auth import get_user_model
from hypothesis import HealthCheck, given
from hypothesis.extra.django import TestCase as HypothesisTestCase
from hypothesis import settings as hypothesis_settings
from hypothesis import strategies as st
from rest_framework.test import APIClient


User = get_user_model()

FUZZ_SETTINGS = hypothesis_settings(
    max_examples=30,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)


def invalid_email_values():
    text_without_at = st.text(
        alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="@"),
        min_size=0,
        max_size=40,
    )
    too_long_email = st.text(
        alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd")),
        min_size=245,
        max_size=270,
    ).map(lambda value: f"{value}@example.com")
    return st.one_of(text_without_at, too_long_email)


def invalid_phone_values():
    wrong_length_digits = st.text(
        alphabet=st.characters(whitelist_categories=("Nd",)),
        min_size=0,
        max_size=20,
    ).filter(lambda value: len(value) != 11)
    non_digit_text = st.text(
        alphabet=st.characters(blacklist_categories=("Cs",)),
        min_size=1,
        max_size=20,
    ).filter(lambda value: not value.isdigit())
    return st.one_of(wrong_length_digits, non_digit_text)


def invalid_driver_license_values():
    wrong_length = st.one_of(
        st.text(alphabet=st.characters(blacklist_categories=("Cs",)), min_size=0, max_size=9),
        st.text(alphabet=st.characters(blacklist_categories=("Cs",)), min_size=11, max_size=30),
    )
    bad_symbols = st.text(
        alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="0123456789 "),
        min_size=10,
        max_size=10,
    )
    return st.one_of(wrong_length, bad_symbols)


class RegistrationHypothesisTests(HypothesisTestCase):
    register_url = "/api/auth/register/"

    def setUp(self):
        self.client = APIClient()
        self.valid_payload = {
            "email": "driver@example.com",
            "password": "StrongPass123",
            "password_confirm": "StrongPass123",
            "first_name": "Anna",
            "last_name": "Ivanova",
            "patronymic": "Sergeevna",
            "phone": "79990001122",
            "driver_license_number": "1234123456",
        }

    def payload_with(self, **overrides):
        payload = deepcopy(self.valid_payload)
        payload.update(overrides)
        return payload

    @FUZZ_SETTINGS
    @given(email=invalid_email_values())
    def test_registration_rejects_generated_invalid_emails(self, email):
        before_count = User.objects.count()

        response = self.client.post(
            self.register_url,
            self.payload_with(email=email),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), before_count)

    @FUZZ_SETTINGS
    @given(phone=invalid_phone_values())
    def test_registration_rejects_generated_invalid_phone_numbers(self, phone):
        before_count = User.objects.count()

        response = self.client.post(
            self.register_url,
            self.payload_with(phone=phone),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), before_count)

    @FUZZ_SETTINGS
    @given(driver_license_number=invalid_driver_license_values())
    def test_registration_rejects_generated_invalid_driver_licenses(self, driver_license_number):
        before_count = User.objects.count()

        response = self.client.post(
            self.register_url,
            self.payload_with(driver_license_number=driver_license_number),
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), before_count)
