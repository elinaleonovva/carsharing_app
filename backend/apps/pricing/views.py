from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole, IsNotBlocked
from apps.rentals.models import BonusZone, TimeCoefficient

from .serializers import BonusZoneSerializer, TariffSerializer, TimeCoefficientSerializer
from .services import get_tariff


class ServiceAccessMixin:
    permission_classes = [IsNotBlocked]

    def check_service_access(self, request):
        if not request.user.can_use_service:
            return Response(
                {"detail": "Доступ к сервису еще не открыт администратором"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None


class BonusZonesAPIView(ServiceAccessMixin, APIView):
    def get(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        zone = BonusZone.objects.filter(is_active=True).order_by("id").first()
        return Response(BonusZoneSerializer([zone], many=True).data if zone else [])


class AdminTariffAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(TariffSerializer(get_tariff()).data)

    def patch(self, request):
        tariff = get_tariff()
        serializer = TariffSerializer(tariff, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        tariff = serializer.save()
        return Response(TariffSerializer(tariff).data)


class AdminCoefficientsAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(TimeCoefficientSerializer(TimeCoefficient.objects.all(), many=True).data)

    def post(self, request):
        serializer = TimeCoefficientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        coefficient = serializer.save()
        return Response(TimeCoefficientSerializer(coefficient).data, status=status.HTTP_201_CREATED)


class AdminCoefficientDetailAPIView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        coefficient = TimeCoefficient.objects.get(pk=pk)
        serializer = TimeCoefficientSerializer(coefficient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        coefficient = serializer.save()
        return Response(TimeCoefficientSerializer(coefficient).data)


class AdminBonusZonesAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        zone = BonusZone.objects.order_by("id").first()
        return Response(BonusZoneSerializer([zone], many=True).data if zone else [])

    def post(self, request):
        zone = BonusZone.objects.order_by("id").first()
        serializer = BonusZoneSerializer(zone, data=request.data, partial=zone is not None)
        serializer.is_valid(raise_exception=True)
        zone = serializer.save()
        return Response(BonusZoneSerializer(zone).data, status=status.HTTP_201_CREATED)


class AdminBonusZoneDetailAPIView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        zone = BonusZone.objects.get(pk=pk)
        serializer = BonusZoneSerializer(zone, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        zone = serializer.save()
        return Response(BonusZoneSerializer(zone).data)
