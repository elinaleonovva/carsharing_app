from django.urls import path

from .views import (
    AdminApplicationsAPIView,
    AdminCarDetailAPIView,
    AdminCarsAPIView,
    AdminCoefficientsAPIView,
    AdminTariffAPIView,
    AdminUserActionAPIView,
    BookingCancelAPIView,
    BookingsAPIView,
    CarsAPIView,
    TripFinishAPIView,
    TripStartAPIView,
    TripsAPIView,
    WalletAPIView,
    WalletTopUpAPIView,
)


urlpatterns = [
    path("cars/", CarsAPIView.as_view(), name="cars"),
    path("bookings/", BookingsAPIView.as_view(), name="bookings"),
    path("bookings/<int:pk>/cancel/", BookingCancelAPIView.as_view(), name="booking-cancel"),
    path("trips/", TripsAPIView.as_view(), name="trips"),
    path("trips/start/", TripStartAPIView.as_view(), name="trip-start"),
    path("trips/<int:pk>/finish/", TripFinishAPIView.as_view(), name="trip-finish"),
    path("wallet/", WalletAPIView.as_view(), name="wallet"),
    path("wallet/top-up/", WalletTopUpAPIView.as_view(), name="wallet-top-up"),
    path("admin/applications/", AdminApplicationsAPIView.as_view(), name="admin-applications"),
    path("admin/users/<int:pk>/action/", AdminUserActionAPIView.as_view(), name="admin-user-action"),
    path("admin/cars/", AdminCarsAPIView.as_view(), name="admin-cars"),
    path("admin/cars/<int:pk>/", AdminCarDetailAPIView.as_view(), name="admin-car-detail"),
    path("admin/tariff/", AdminTariffAPIView.as_view(), name="admin-tariff"),
    path("admin/coefficients/", AdminCoefficientsAPIView.as_view(), name="admin-coefficients"),
]
