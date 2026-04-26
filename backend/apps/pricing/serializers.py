from rest_framework import serializers

from apps.rentals.geo import is_inside_mkad
from apps.rentals.models import BonusZone, Tariff, TimeCoefficient


class TariffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tariff
        fields = ("id", "name", "price_per_minute", "min_start_balance")


class TimeCoefficientSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeCoefficient
        fields = ("id", "name", "start_time", "end_time", "coefficient")


class BonusZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = BonusZone
        fields = (
            "id",
            "name",
            "latitude",
            "longitude",
            "radius_meters",
            "discount_percent",
            "is_active",
            "created_at",
        )

    def validate(self, attrs):
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if latitude is not None and longitude is not None and not is_inside_mkad(latitude, longitude):
            raise serializers.ValidationError("Зону можно поставить только внутри МКАД")
        return attrs
