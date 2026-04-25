from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminRole, IsNotBlocked

from .models import Booking, Car, Tariff, TimeCoefficient, Trip, WalletTransaction
from .serializers import (
    AdminUserActionSerializer,
    AdminUserSerializer,
    BookingSerializer,
    CarSerializer,
    FinishTripSerializer,
    StartTripSerializer,
    TariffSerializer,
    TimeCoefficientSerializer,
    TopUpSerializer,
    TripSerializer,
    WalletTransactionSerializer,
)
from .services import cancel_booking, create_booking, finish_trip, get_tariff, start_trip, top_up_wallet


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

        cars = Car.objects.exclude(status__in=[Car.Status.SERVICE, Car.Status.INACTIVE])
        return Response(CarSerializer(cars, many=True).data)


class BookingsAPIView(ServiceAccessMixin, APIView):
    def get(self, request):
        access_error = self.check_service_access(request)
        if access_error:
            return access_error

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


class AdminApplicationsAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        users = User.objects.filter(role=User.Role.USER).order_by("-date_joined")
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
        elif action == "block":
            user.is_blocked = True
        elif action == "unblock":
            user.is_blocked = False

        user.save(update_fields=["verification_status", "is_blocked"])
        return Response(AdminUserSerializer(user).data)


class AdminCarsAPIView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
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
