from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.rentals.models import Car, Tariff, TimeCoefficient


MOSCOW_CARS = [
    ("Haval", "Jolion", "A123BC797", "55.751244", "37.618423"),
    ("Geely", "Coolray", "E456KM797", "55.760102", "37.618901"),
    ("Chery", "Tiggo 4", "O781PT797", "55.744825", "37.605911"),
    ("Belgee", "X50", "K238MH797", "55.757487", "37.582214"),
    ("Exeed", "LX", "C904XA797", "55.766320", "37.604980"),
    ("Omoda", "C5", "M517OP797", "55.771831", "37.638295"),
    ("Jetour", "Dashing", "H342TY797", "55.737819", "37.642546"),
    ("Changan", "CS35 Plus", "P609EC797", "55.729771", "37.603982"),
    ("JAC", "JS6", "T275AK797", "55.780992", "37.601048"),
    ("Haval", "F7", "Y846BH797", "55.786111", "37.664557"),
    ("Geely", "Atlas", "X130KC797", "55.732930", "37.666348"),
    ("Chery", "Arrizo 8", "B491ME797", "55.719132", "37.628050"),
    ("Belgee", "X70", "A762HO797", "55.713269", "37.586198"),
    ("Exeed", "TXL", "E318PK797", "55.705415", "37.647290"),
    ("Omoda", "S5", "K957CT797", "55.793802", "37.636496"),
    ("Jetour", "X70 Plus", "M204YX797", "55.797539", "37.570168"),
    ("Changan", "UNI-T", "O685BA797", "55.748004", "37.537087"),
    ("JAC", "J7", "H731EK797", "55.742278", "37.563984"),
    ("Haval", "M6", "P052MC797", "55.765349", "37.545911"),
    ("Geely", "Preface", "C489OP797", "55.775424", "37.690343"),
    ("Chery", "Tiggo 7 Pro", "T614HA797", "55.788190", "37.703994"),
    ("Belgee", "S50", "Y275KT797", "55.698455", "37.709801"),
    ("Exeed", "RX", "X938PE797", "55.691770", "37.653378"),
    ("Omoda", "C7", "A407CO797", "55.683322", "37.595106"),
    ("Jetour", "T2", "B826AM797", "55.677847", "37.559891"),
    ("Changan", "UNI-K", "E590TK797", "55.801457", "37.548428"),
    ("JAC", "T8 Pro", "K163XH797", "55.812786", "37.583255"),
    ("Haval", "Dargo", "M724BP797", "55.819741", "37.630981"),
    ("Geely", "Monjaro", "O351EM797", "55.735900", "37.520500"),
    ("Chery", "Tiggo 8 Pro", "H982CK797", "55.707746", "37.540091"),
]

LEGACY_DEMO_PLATES = ["A111AA", "B222BB", "C333CC"]


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

        for old_plate, (_, _, new_plate, _, _) in zip(LEGACY_DEMO_PLATES, MOSCOW_CARS):
            legacy_car = Car.objects.filter(license_plate=old_plate).first()
            if legacy_car and not Car.objects.filter(license_plate=new_plate).exclude(pk=legacy_car.pk).exists():
                legacy_car.license_plate = new_plate
                legacy_car.save(update_fields=["license_plate"])

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
