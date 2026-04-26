from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.rentals.models import BonusZone, Car, Tariff, TimeCoefficient


MOSCOW_CARS = [
    ("Haval", "Jolion", "A123BC797", "55.751244", "37.618423", "11.00"),
    ("Geely", "Coolray", "E456KM797", "55.760102", "37.618901", "13.00"),
    ("Chery", "Tiggo 4", "O781PT797", "55.744825", "37.605911", "12.00"),
    ("Belgee", "X50", "K238MH797", "55.757487", "37.582214", "10.00"),
    ("Exeed", "LX", "C904XA797", "55.766320", "37.604980", "17.00"),
    ("Omoda", "C5", "M517OP797", "55.771831", "37.638295", "13.00"),
    ("Jetour", "Dashing", "H342TY797", "55.737819", "37.642546", "14.00"),
    ("Changan", "CS35 Plus", "P609EC797", "55.729771", "37.603982", "12.00"),
    ("JAC", "JS6", "T275AK797", "55.780992", "37.601048", "11.00"),
    ("Haval", "F7", "Y846BH797", "55.786111", "37.664557", "14.00"),
    ("Geely", "Atlas", "X130KC797", "55.732930", "37.666348", "15.00"),
    ("Chery", "Arrizo 8", "B491ME797", "55.719132", "37.628050", "14.00"),
    ("Belgee", "X70", "A762HO797", "55.713269", "37.586198", "12.00"),
    ("Exeed", "TXL", "E318PK797", "55.705415", "37.647290", "18.00"),
    ("Omoda", "S5", "K957CT797", "55.793802", "37.636496", "12.00"),
    ("Jetour", "X70 Plus", "M204YX797", "55.797539", "37.570168", "15.00"),
    ("Changan", "UNI-T", "O685BA797", "55.748004", "37.537087", "14.00"),
    ("JAC", "J7", "H731EK797", "55.742278", "37.563984", "11.00"),
    ("Haval", "M6", "P052MC797", "55.765349", "37.545911", "11.00"),
    ("Geely", "Preface", "C489OP797", "55.775424", "37.690343", "15.00"),
    ("Chery", "Tiggo 7 Pro", "T614HA797", "55.788190", "37.703994", "15.00"),
    ("Belgee", "S50", "Y275KT797", "55.698455", "37.709801", "10.00"),
    ("Exeed", "RX", "X938PE797", "55.691770", "37.653378", "20.00"),
    ("Omoda", "C7", "A407CO797", "55.683322", "37.595106", "16.00"),
    ("Jetour", "T2", "B826AM797", "55.677847", "37.559891", "17.00"),
    ("Changan", "UNI-K", "E590TK797", "55.801457", "37.548428", "16.00"),
    ("JAC", "T8 Pro", "K163XH797", "55.812786", "37.583255", "13.00"),
    ("Haval", "Dargo", "M724BP797", "55.819741", "37.630981", "16.00"),
    ("Geely", "Monjaro", "O351EM797", "55.735900", "37.520500", "19.00"),
    ("Chery", "Tiggo 8 Pro", "H982CK797", "55.707746", "37.540091", "17.00"),
]

LEGACY_DEMO_PLATES = ["A111AA", "B222BB", "C333CC"]

BONUS_ZONES = [
    ("Скидочная зона у Парка Горького", "55.729800", "37.603700", 650, Decimal("10.00")),
    ("Скидочная зона у Сокольников", "55.794000", "37.676200", 700, Decimal("10.00")),
    ("Скидочная зона у Москва-Сити", "55.749500", "37.539600", 600, Decimal("10.00")),
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

        coefficients = [
            ("Ночь", "00:00", "06:30", Decimal("0.85")),
            ("Утро, час пик", "06:30", "10:00", Decimal("1.35")),
            ("День", "10:00", "16:30", Decimal("1.00")),
            ("Вечер, час пик", "16:30", "20:30", Decimal("1.45")),
            ("Поздний вечер", "20:30", "00:00", Decimal("1.10")),
        ]
        TimeCoefficient.objects.exclude(name__in=[name for name, _, _, _ in coefficients]).delete()
        for name, start_time, end_time, coefficient in coefficients:
            TimeCoefficient.objects.update_or_create(
                name=name,
                defaults={
                    "start_time": start_time,
                    "end_time": end_time,
                    "coefficient": coefficient,
                },
            )

        for old_plate, (_, _, new_plate, _, _, _) in zip(LEGACY_DEMO_PLATES, MOSCOW_CARS):
            legacy_car = Car.objects.filter(license_plate=old_plate).first()
            if legacy_car and not Car.objects.filter(license_plate=new_plate).exclude(pk=legacy_car.pk).exists():
                legacy_car.license_plate = new_plate
                legacy_car.save(update_fields=["license_plate"])

        for brand, model, plate, latitude, longitude, price_per_minute in MOSCOW_CARS:
            Car.objects.update_or_create(
                license_plate=plate,
                defaults={
                    "brand": brand,
                    "model": model,
                    "status": Car.Status.AVAILABLE,
                    "latitude": latitude,
                    "longitude": longitude,
                    "price_per_minute": Decimal(price_per_minute),
                },
            )

        for name, latitude, longitude, radius_meters, discount_percent in BONUS_ZONES:
            BonusZone.objects.update_or_create(
                name=name,
                defaults={
                    "latitude": latitude,
                    "longitude": longitude,
                    "radius_meters": radius_meters,
                    "discount_percent": discount_percent,
                    "is_active": True,
                },
            )

        self.stdout.write(self.style.SUCCESS(f"Demo data created: {len(MOSCOW_CARS)} cars"))
