from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.rentals.models import Car, Tariff, TimeCoefficient


class Command(BaseCommand):
    help = "Create demo admin, tariff, coefficients and cars"

    def handle(self, *args, **options):
        User = get_user_model()

        admin = User.objects.filter(email="admin@example.com").first()
        if admin is None:
            admin = User.objects.filter(username="admin").first()

        if admin is None:
            admin = User(username="admin", email="admin@example.com")

        if not User.objects.filter(email="admin@example.com").exclude(pk=admin.pk).exists():
            admin.email = "admin@example.com"
        admin.first_name = "Админ"
        admin.last_name = "Системный"
        admin.patronymic = "Петрович"
        admin.phone = "79990000000"
        admin.driver_license_number = "99 99 999999"
        admin.role = User.Role.ADMIN
        admin.verification_status = User.VerificationStatus.APPROVED
        admin.is_staff = True
        admin.is_superuser = True
        admin.set_password("Admin12345")
        admin.save()

        Tariff.objects.update_or_create(
            pk=1,
            defaults={
                "name": "Базовый",
                "price_per_minute": Decimal("8.00"),
                "min_start_balance": Decimal("100.00"),
            },
        )

        TimeCoefficient.objects.update_or_create(
            name="День",
            defaults={
                "start_time": "08:00",
                "end_time": "20:00",
                "coefficient": Decimal("1.00"),
            },
        )
        TimeCoefficient.objects.update_or_create(
            name="Вечер",
            defaults={
                "start_time": "20:00",
                "end_time": "08:00",
                "coefficient": Decimal("1.25"),
            },
        )

        cars = [
            ("Haval", "Jolion", "A111AA", "55.751244", "37.618423"),
            ("Geely", "Coolray", "B222BB", "55.760000", "37.620000"),
            ("Chery", "Tiggo 4", "C333CC", "55.744500", "37.605000"),
        ]

        for brand, model, plate, latitude, longitude in cars:
            Car.objects.update_or_create(
                license_plate=plate,
                defaults={
                    "brand": brand,
                    "model": model,
                    "status": Car.Status.AVAILABLE,
                    "latitude": latitude,
                    "longitude": longitude,
                },
            )

        self.stdout.write(self.style.SUCCESS("Demo data created"))
