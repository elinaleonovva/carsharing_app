from rest_framework import serializers

from apps.rentals.geo import is_inside_mkad
from apps.rentals.models import BonusZone, Tariff, TimeCoefficient


class TariffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tariff
        fields = ("id", "name", "price_per_minute", "min_start_balance")

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Требуется указать название тарифа")
        return name

    def validate_price_per_minute(self, value):
        if value <= 0:
            raise serializers.ValidationError("Цена за минуту должна быть больше нуля")
        return value

    def validate_min_start_balance(self, value):
        if value < 0:
            raise serializers.ValidationError("Минимальный начальный баланс не может быть отрицательным")
        return value


class TimeCoefficientSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeCoefficient
        fields = ("id", "name", "start_time", "end_time", "coefficient")

    def validate_coefficient(self, value):
        if value <= 0:
            raise serializers.ValidationError("Коэффициент должен быть больше нуля")
        if value > 9:
            raise serializers.ValidationError("Коэффициент не может быть больше 9")
        return value


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

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Bonus zone name is required")
        return name

    def validate_radius_meters(self, value):
        if value < 50:
            raise serializers.ValidationError("Bonus zone radius must be at least 50 meters")
        if value > 5000:
            raise serializers.ValidationError("Bonus zone radius cannot be greater than 5000 meters")
        return value

    def validate_discount_percent(self, value):
        if value < 0:
            raise serializers.ValidationError("Discount percent cannot be negative")
        if value > 100:
            raise serializers.ValidationError("Discount percent cannot be greater than 100")
        return value

    def validate(self, attrs):
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if latitude is not None and longitude is not None and not is_inside_mkad(latitude, longitude):
            raise serializers.ValidationError("Зону можно поставить только внутри МКАД")
        return attrs
