from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.rentals.models import Car, Tariff, TimeCoefficient


MOSCOW_CARS = [
    ("Haval", "Jolion", "A111AA797", "55.751244", "37.618423"),
    ("Geely", "Coolray", "B222BB797", "55.760102", "37.618901"),
    ("Chery", "Tiggo 4", "C333CC797", "55.744825", "37.605911"),
    ("Belgee", "X50", "E444EE797", "55.757487", "37.582214"),
    ("Exeed", "LX", "K555KK797", "55.766320", "37.604980"),
    ("Omoda", "C5", "M666MM797", "55.771831", "37.638295"),
    ("Jetour", "Dashing", "H777HH797", "55.737819", "37.642546"),
    ("Changan", "CS35 Plus", "T888TT797", "55.729771", "37.603982"),
    ("JAC", "JS6", "P999PP797", "55.780992", "37.601048"),
    ("Haval", "F7", "Y101YY797", "55.786111", "37.664557"),
    ("Geely", "Atlas", "A202AA797", "55.732930", "37.666348"),
    ("Chery", "Arrizo 8", "B303BB797", "55.719132", "37.628050"),
    ("Belgee", "X70", "C404CC797", "55.713269", "37.586198"),
    ("Exeed", "TXL", "E505EE797", "55.705415", "37.647290"),
    ("Omoda", "S5", "K606KK797", "55.793802", "37.636496"),
    ("Jetour", "X70 Plus", "M707MM797", "55.797539", "37.570168"),
    ("Changan", "UNI-T", "H808HH797", "55.748004", "37.537087"),
    ("JAC", "J7", "T909TT797", "55.742278", "37.563984"),
    ("Haval", "M6", "P010PP797", "55.765349", "37.545911"),
    ("Geely", "Preface", "Y111YY797", "55.775424", "37.690343"),
    ("Chery", "Tiggo 7 Pro", "A212AA797", "55.788190", "37.703994"),
    ("Belgee", "S50", "B313BB797", "55.698455", "37.709801"),
    ("Exeed", "RX", "C414CC797", "55.691770", "37.653378"),
    ("Omoda", "C7", "E515EE797", "55.683322", "37.595106"),
    ("Jetour", "T2", "K616KK797", "55.677847", "37.559891"),
    ("Changan", "UNI-K", "M717MM797", "55.801457", "37.548428"),
    ("JAC", "T8 Pro", "H818HH797", "55.812786", "37.583255"),
    ("Haval", "Dargo", "T919TT797", "55.819741", "37.630981"),
    ("Geely", "Monjaro", "P020PP797", "55.728040", "37.546082"),
    ("Chery", "Tiggo 8 Pro", "Y121YY797", "55.707746", "37.540091"),
]


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

        for brand, model, plate, latitude, longitude in MOSCOW_CARS:
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

        self.stdout.write(self.style.SUCCESS(f"Demo data created: {len(MOSCOW_CARS)} cars"))
