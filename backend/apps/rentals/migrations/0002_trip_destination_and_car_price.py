from decimal import Decimal

from django.db import migrations, models


def fill_car_prices(apps, schema_editor):
    Car = apps.get_model("rentals", "Car")
    premium_brands = {"bmw", "mercedes", "audi", "exeed"}
    comfort_brands = {"toyota", "volvo", "mazda", "chery", "geely"}
    city_brands = {"kia", "nissan", "skoda", "renault", "reno", "ford"}

    for car in Car.objects.all():
        price = Decimal("10.00")
        brand = car.brand.lower()
        if brand in premium_brands:
            price = Decimal("18.00")
        elif brand in comfort_brands:
            price = Decimal("14.00")
        elif brand in city_brands:
            price = Decimal("12.00")

        car.price_per_minute = price
        car.save(update_fields=["price_per_minute"])


class Migration(migrations.Migration):

    dependencies = [
        ("rentals", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="car",
            name="price_per_minute",
            field=models.DecimalField(decimal_places=2, default=Decimal("10.00"), max_digits=8),
        ),
        migrations.AddField(
            model_name="trip",
            name="destination_latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="trip",
            name="destination_longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.RunPython(fill_car_prices, migrations.RunPython.noop),
    ]
