from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import IsNotBlocked
from .serializers import (
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    VerificationRequestSerializer,
)


class RegisterAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "detail": "Заявка отправлена. Дождитесь подтверждения администратора, затем выполните вход.",
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED,
        )


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "token": token.key,
                "user": UserSerializer(user).data,
            }
        )


class LogoutAPIView(APIView):
    permission_classes = [IsNotBlocked]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeAPIView(APIView):
    permission_classes = [IsNotBlocked]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class VerificationRequestAPIView(APIView):
    permission_classes = [IsNotBlocked]

    def post(self, request):
        serializer = VerificationRequestSerializer(data={}, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        return Response(
            {
                "status": user.verification_status,
                "user": UserSerializer(user).data,
            }
        )
