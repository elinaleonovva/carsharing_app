import re
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.serializers import UserSerializer

from .geo import is_inside_mkad
from .models import Booking, Car, Trip, WalletTransaction


User = get_user_model()

LICENSE_PLATE_RE = re.compile(r"^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\d{2,3}$")


def validate_mkad_coordinates(attrs):
    if not is_inside_mkad(attrs["latitude"], attrs["longitude"]):
        raise serializers.ValidationError("Точку можно поставить только внутри МКАД")
    return attrs


class CarSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Car
        fields = (
            "id",
            "brand",
            "model",
            "license_plate",
            "status",
            "status_label",
            "latitude",
            "longitude",
            "price_per_minute",
            "created_at",
        )
        read_only_fields = ("id", "status", "status_label", "created_at")

    def validate_license_plate(self, value):
        license_plate = re.sub(r"[\s-]+", "", value.strip()).upper()
        if not LICENSE_PLATE_RE.fullmatch(license_plate):
            raise serializers.ValidationError("Введите госномер в формате А123ВС77 или А123ВС777")
        return license_plate

    def validate(self, attrs):
        latitude = attrs.get("latitude", self.instance.latitude if self.instance else None)
        longitude = attrs.get("longitude", self.instance.longitude if self.instance else None)

        if latitude is not None and longitude is not None:
            validate_mkad_coordinates({"latitude": latitude, "longitude": longitude})

        return attrs


class BookingSerializer(serializers.ModelSerializer):
    car = CarSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    car_id = serializers.PrimaryKeyRelatedField(
        queryset=Car.objects.all(),
        source="car",
        write_only=True,
    )

    class Meta:
        model = Booking
        fields = ("id", "user", "car", "car_id", "status", "created_at", "closed_at")
        read_only_fields = ("id", "car", "status", "created_at", "closed_at")


class TripSerializer(serializers.ModelSerializer):
    car = CarSerializer(read_only=True)
    user = UserSerializer(read_only=True)
    bonus_zone_name = serializers.CharField(source="bonus_zone.name", read_only=True)

    class Meta:
        model = Trip
        fields = (
            "id",
            "user",
            "car",
            "status",
            "started_at",
            "finished_at",
            "start_latitude",
            "start_longitude",
            "destination_latitude",
            "destination_longitude",
            "end_latitude",
            "end_longitude",
            "price_per_minute",
            "coefficient",
            "bonus_zone_name",
            "discount_percent",
            "total_minutes",
            "total_price",
        )


class StartTripSerializer(serializers.Serializer):
    car_id = serializers.PrimaryKeyRelatedField(queryset=Car.objects.all(), source="car")
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)

    def validate(self, attrs):
        return validate_mkad_coordinates(attrs)


class FinishTripSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    route_duration_minutes = serializers.IntegerField(min_value=1, required=False)

    def validate(self, attrs):
        return validate_mkad_coordinates(attrs)


class TripDestinationSerializer(serializers.Serializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)

    def validate(self, attrs):
        return validate_mkad_coordinates(attrs)


class WalletTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WalletTransaction
        fields = ("id", "transaction_type", "amount", "description", "created_at")


class TopUpSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("1.00"))


class AdminUserSerializer(UserSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + ("full_name",)

    def get_full_name(self, obj):
        return " ".join(
            part for part in [obj.last_name, obj.first_name, obj.patronymic] if part
        )


class AdminUserActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["approve", "reject"])
