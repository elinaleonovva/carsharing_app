from django.urls import path

from .views import (
    AdminBonusZoneDetailAPIView,
    AdminBonusZonesAPIView,
    AdminCoefficientDetailAPIView,
    AdminCoefficientsAPIView,
    AdminTariffAPIView,
    BonusZonesAPIView,
)


urlpatterns = [
    path("bonus-zones/", BonusZonesAPIView.as_view(), name="bonus-zones"),
    path("admin/tariff/", AdminTariffAPIView.as_view(), name="admin-tariff"),
    path("admin/coefficients/", AdminCoefficientsAPIView.as_view(), name="admin-coefficients"),
    path("admin/coefficients/<int:pk>/", AdminCoefficientDetailAPIView.as_view(), name="admin-coefficient-detail"),
    path("admin/bonus-zones/", AdminBonusZonesAPIView.as_view(), name="admin-bonus-zones"),
    path("admin/bonus-zones/<int:pk>/", AdminBonusZoneDetailAPIView.as_view(), name="admin-bonus-zone-detail"),
]
