from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminRole, IsNotBlocked

from .models import Booking, Car, Trip, WalletTransaction
from .serializers import (
    AdminUserActionSerializer,
    AdminUserSerializer,
    BookingSerializer,
    CarSerializer,
    FinishTripSerializer,
    StartTripSerializer,
    TopUpSerializer,
    TripSerializer,
    TripDestinationSerializer,
    WalletTransactionSerializer,
)
from .services import (
    cancel_booking,
    create_booking,
    expire_stale_bookings,
    finish_trip,
    set_trip_destination,
    start_trip,
    top_up_wallet,
)


class ServiceAccessMixin:
    permission_classes = [IsNotBlocked]

    def check_service_access(self, request):
        if not request.user.can_use_service:
            return Response(
                {"detail": "Доступ к сервису еще не открыт администратором"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None


class CarsAPIView(ServiceAccessMixin, APIView):
    def get(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        expire_stale_bookings()
        cars = Car.objects.exclude(status__in=[Car.Status.SERVICE, Car.Status.INACTIVE])
        return Response(CarSerializer(cars, many=True).data)


class BookingsAPIView(ServiceAccessMixin, APIView):
    def get(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        expire_stale_bookings()
        booking = Booking.objects.filter(user=request.user, status=Booking.Status.ACTIVE).first()
        return Response(BookingSerializer(booking).data if booking else None)

    def post(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        serializer = BookingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = create_booking(request.user, serializer.validated_data["car"])
        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class BookingCancelAPIView(ServiceAccessMixin, APIView):
    def post(self, request, pk):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        booking = Booking.objects.get(pk=pk, user=request.user)
        booking = cancel_booking(booking)
        return Response(BookingSerializer(booking).data)


class TripsAPIView(ServiceAccessMixin, APIView):
    def get(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        expire_stale_bookings()
        active_trip = Trip.objects.filter(user=request.user, status=Trip.Status.ACTIVE).first()
        history = Trip.objects.filter(user=request.user, status=Trip.Status.COMPLETED)[:10]
        return Response(
            {
                "active": TripSerializer(active_trip).data if active_trip else None,
                "history": TripSerializer(history, many=True).data,
            }
        )


class TripStartAPIView(ServiceAccessMixin, APIView):
    def post(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        serializer = StartTripSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trip = start_trip(
            request.user,
            serializer.validated_data["car"],
            serializer.validated_data["latitude"],
            serializer.validated_data["longitude"],
        )
        return Response(TripSerializer(trip).data, status=status.HTTP_201_CREATED)


class TripFinishAPIView(ServiceAccessMixin, APIView):
    def post(self, request, pk):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        trip = Trip.objects.get(pk=pk, user=request.user)
        serializer = FinishTripSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trip = finish_trip(
            trip,
            serializer.validated_data["latitude"],
            serializer.validated_data["longitude"],
            serializer.validated_data.get("route_duration_minutes"),
        )
        return Response(TripSerializer(trip).data)


class TripDestinationAPIView(ServiceAccessMixin, APIView):
    def post(self, request, pk):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        trip = Trip.objects.get(pk=pk, user=request.user)
        serializer = TripDestinationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        trip = set_trip_destination(
            trip,
            serializer.validated_data["latitude"],
            serializer.validated_data["longitude"],
        )
        return Response(TripSerializer(trip).data)


class WalletAPIView(ServiceAccessMixin, APIView):
    def get(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        transactions = WalletTransaction.objects.filter(user=request.user)[:10]
        return Response(
            {
                "balance": request.user.balance,
                "transactions": WalletTransactionSerializer(transactions, many=True).data,
            }
        )


class WalletTopUpAPIView(ServiceAccessMixin, APIView):
    def post(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

        serializer = TopUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        transaction = top_up_wallet(request.user, serializer.validated_data["amount"])
        return Response(WalletTransactionSerializer(transaction).data, status=status.HTTP_201_CREATED)


class AdminUsersAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        users = User.objects.filter(role=User.Role.USER).order_by("-date_joined")
        return Response(AdminUserSerializer(users, many=True).data)


class AdminApplicationsAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        users = User.objects.filter(
            role=User.Role.USER,
            verification_status=User.VerificationStatus.PENDING,
        ).order_by("-date_joined")
        return Response(AdminUserSerializer(users, many=True).data)


class AdminUserActionAPIView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        user = User.objects.get(pk=pk)
        serializer = AdminUserActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action = serializer.validated_data["action"]

        if action == "approve":
            user.verification_status = User.VerificationStatus.APPROVED
            user.is_blocked = False
        elif action == "reject":
            user.verification_status = User.VerificationStatus.REJECTED

        user.save(update_fields=["verification_status", "is_blocked"])
        return Response(AdminUserSerializer(user).data)


class AdminCarsAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        expire_stale_bookings()
        return Response(CarSerializer(Car.objects.all(), many=True).data)

    def post(self, request):
        serializer = CarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        car = serializer.save()
        return Response(CarSerializer(car).data, status=status.HTTP_201_CREATED)


class AdminCarDetailAPIView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, pk):
        car = Car.objects.get(pk=pk)
        serializer = CarSerializer(car, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        car = serializer.save()
        return Response(CarSerializer(car).data)


class AdminBookingsAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        expire_stale_bookings()
        bookings = Booking.objects.select_related("user", "car").order_by("-created_at")
        return Response(BookingSerializer(bookings, many=True).data)


class AdminTripsAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        trips = Trip.objects.select_related("user", "car", "bonus_zone").order_by("-started_at")
        return Response(TripSerializer(trips, many=True).data)


