from decimal import Decimal
from math import asin, cos, radians, sin, sqrt

from django.utils import timezone

from apps.rentals.models import BonusZone, Tariff, TimeCoefficient


EARTH_RADIUS_METERS = 6371000


def get_tariff() -> Tariff:
    tariff, _ = Tariff.objects.get_or_create(
        pk=1,
        defaults={
            "name": "Базовый",
            "price_per_minute": Decimal("8.00"),
            "min_start_balance": Decimal("100.00"),
        },
    )
    return tariff


def get_current_coefficient() -> Decimal:
    current_time = timezone.localtime().time()

    for coefficient in TimeCoefficient.objects.all():
        if coefficient.contains(current_time):
            return coefficient.coefficient

    return Decimal("1.00")


def calculate_distance_meters(latitude_from, longitude_from, latitude_to, longitude_to) -> float:
    lat_from = radians(float(latitude_from))
    lon_from = radians(float(longitude_from))
    lat_to = radians(float(latitude_to))
    lon_to = radians(float(longitude_to))
    lat_delta = lat_to - lat_from
    lon_delta = lon_to - lon_from
    haversine = sin(lat_delta / 2) ** 2 + cos(lat_from) * cos(lat_to) * sin(lon_delta / 2) ** 2
    return 2 * EARTH_RADIUS_METERS * asin(sqrt(haversine))


def find_bonus_zone(latitude, longitude) -> BonusZone | None:
    for zone in BonusZone.objects.filter(is_active=True):
        distance = calculate_distance_meters(latitude, longitude, zone.latitude, zone.longitude)
        if distance <= zone.radius_meters:
            return zone

    return None
