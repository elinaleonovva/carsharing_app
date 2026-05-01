from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.rentals.models import Car, Tariff, TimeCoefficient


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
    ("Kia", "Rio", "A541TK797", "55.752880", "37.569441", "10.00"),
    ("Kia", "Sportage", "E274HA797", "55.742116", "37.671248", "14.00"),
    ("Kia", "K5", "M908BP797", "55.781403", "37.655871", "15.00"),
    ("Nissan", "Qashqai", "K617MP797", "55.769845", "37.552610", "13.00"),
    ("Nissan", "X-Trail", "O452PE797", "55.726950", "37.684812", "15.00"),
    ("Nissan", "Sentra", "T381OK797", "55.707102", "37.600447", "11.00"),
    ("Hyundai", "Solaris", "B153HE797", "55.797854", "37.612935", "10.00"),
    ("Hyundai", "Creta", "C824PA797", "55.785220", "37.714532", "13.00"),
    ("Hyundai", "Elantra", "Y962CK797", "55.718940", "37.556128", "12.00"),
    ("Mazda", "3", "P406MY797", "55.744603", "37.699125", "12.00"),
    ("Mazda", "6", "H518AO797", "55.771218", "37.521904", "14.00"),
    ("Mazda", "CX-5", "X349PT797", "55.693145", "37.618774", "15.00"),
    ("Toyota", "Corolla", "A286MA797", "55.807654", "37.658130", "12.00"),
    ("Toyota", "Camry", "E670TP797", "55.733508", "37.569982", "16.00"),
    ("Toyota", "RAV4", "K214BX797", "55.758211", "37.706344", "15.00"),
    ("BMW", "320i", "M735TA797", "55.784664", "37.585714", "18.00"),
    ("BMW", "X1", "O168HC797", "55.716232", "37.671953", "19.00"),
    ("Mercedes", "C 180", "T593CM797", "55.762944", "37.731208", "18.00"),
    ("Mercedes", "GLA 200", "Y840AM797", "55.726408", "37.531902", "20.00"),
    ("Ford", "Focus", "B497PE797", "55.699286", "37.582447", "11.00"),
    ("Ford", "Kuga", "C156TT797", "55.808992", "37.547826", "14.00"),
    ("Volvo", "XC40", "H268XO797", "55.789105", "37.674920", "18.00"),
    ("Volvo", "S60", "X470PB797", "55.712744", "37.702681", "17.00"),
    ("Audi", "A3", "A691EK797", "55.738350", "37.719441", "14.00"),
    ("Audi", "A4", "E902YX797", "55.776993", "37.565228", "17.00"),
    ("Audi", "Q3", "K845HB797", "55.689514", "37.561780", "18.00"),
    ("Skoda", "Octavia", "M314KT797", "55.804431", "37.620905", "12.00"),
    ("Skoda", "Karoq", "O557AH797", "55.729364", "37.710028", "14.00"),
    ("Renault", "Duster", "T628BC797", "55.681602", "37.640912", "12.00"),
    ("Renault", "Arkana", "Y749PC797", "55.754916", "37.503118", "13.00"),
]

LEGACY_DEMO_PLATES = ["A111AA", "B222BB", "C333CC"]


class Command(BaseCommand):
    help = "Create demo tariff, coefficients and cars"

    def handle(self, *args, **options):
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

        self.stdout.write(self.style.SUCCESS(f"Demo data created: {len(MOSCOW_CARS)} cars"))
