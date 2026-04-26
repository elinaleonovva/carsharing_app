from django.urls import include, path

from .views import (
    AdminApplicationsAPIView,
    AdminBookingsAPIView,
    AdminCarDetailAPIView,
    AdminCarsAPIView,
    AdminUserActionAPIView,
    AdminTripsAPIView,
    AdminUsersAPIView,
    BookingCancelAPIView,
    BookingsAPIView,
    CarsAPIView,
    TripFinishAPIView,
    TripDestinationAPIView,
    TripStartAPIView,
    TripsAPIView,
    WalletAPIView,
    WalletTopUpAPIView,
)


urlpatterns = [
    path("", include("apps.pricing.urls")),
    path("cars/", CarsAPIView.as_view(), name="cars"),
    path("bookings/", BookingsAPIView.as_view(), name="bookings"),
    path("bookings/<int:pk>/cancel/", BookingCancelAPIView.as_view(), name="booking-cancel"),
    path("trips/", TripsAPIView.as_view(), name="trips"),
    path("trips/start/", TripStartAPIView.as_view(), name="trip-start"),
    path("trips/<int:pk>/destination/", TripDestinationAPIView.as_view(), name="trip-destination"),
    path("trips/<int:pk>/finish/", TripFinishAPIView.as_view(), name="trip-finish"),
    path("wallet/", WalletAPIView.as_view(), name="wallet"),
    path("wallet/top-up/", WalletTopUpAPIView.as_view(), name="wallet-top-up"),
    path("admin/users/", AdminUsersAPIView.as_view(), name="admin-users"),
    path("admin/applications/", AdminApplicationsAPIView.as_view(), name="admin-applications"),
    path("admin/users/<int:pk>/action/", AdminUserActionAPIView.as_view(), name="admin-user-action"),
    path("admin/cars/", AdminCarsAPIView.as_view(), name="admin-cars"),
    path("admin/cars/<int:pk>/", AdminCarDetailAPIView.as_view(), name="admin-car-detail"),
    path("admin/bookings/", AdminBookingsAPIView.as_view(), name="admin-bookings"),
    path("admin/trips/", AdminTripsAPIView.as_view(), name="admin-trips"),
]
