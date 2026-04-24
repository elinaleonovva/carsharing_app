from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User


def clean_message(message: str) -> str:
    return message.strip().rstrip(".!?")


def translate_password_errors(exc: DjangoValidationError) -> list[str]:
    translated_messages = []

    for message in exc.messages:
        lowered = message.lower()

        if "too short" in lowered:
            translated_messages.append("Пароль должен содержать не менее 8 символов")
        elif "too common" in lowered:
            translated_messages.append("Пароль слишком простой")
        elif "entirely numeric" in lowered:
            translated_messages.append("Пароль не должен состоять только из цифр")
        elif "too similar" in lowered:
            translated_messages.append("Пароль слишком похож на логин или личные данные")
        else:
            translated_messages.append(clean_message(message))

    return translated_messages


class UserSerializer(serializers.ModelSerializer):
    is_verified = serializers.BooleanField(read_only=True)
    can_use_service = serializers.BooleanField(read_only=True)
    email = serializers.EmailField(
        required=True,
        error_messages={
            "blank": "Введите email",
            "invalid": "Введите корректный email",
            "required": "Введите email",
        },
    )

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "phone",
            "role",
            "verification_status",
            "balance",
            "is_blocked",
            "is_verified",
            "can_use_service",
        )
        read_only_fields = (
            "id",
            "role",
            "verification_status",
            "balance",
            "is_blocked",
            "is_verified",
            "can_use_service",
        )

    def validate_email(self, value):
        email = value.strip().lower()
        queryset = User.objects.filter(email__iexact=email)

        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован")

        return email

    def validate_phone(self, value):
        return value.strip()


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=True,
        allow_blank=False,
        error_messages={
            "blank": "Введите email",
            "invalid": "Введите корректный email",
            "required": "Введите email",
        },
    )
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "blank": "Введите пароль",
            "required": "Введите пароль",
            "min_length": "Пароль должен содержать не менее 8 символов",
        },
    )
    password_confirm = serializers.CharField(
        write_only=True,
        min_length=8,
        error_messages={
            "blank": "Повторите пароль",
            "required": "Повторите пароль",
            "min_length": "Пароль должен содержать не менее 8 символов",
        },
    )

    class Meta:
        model = User
        fields = (
            "email",
            "password",
            "password_confirm",
            "first_name",
            "last_name",
            "phone",
        )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают"})

        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": translate_password_errors(exc)}) from exc

        return attrs

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован")
        return email

    def validate_phone(self, value):
        return value.strip()

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(
        error_messages={
            "blank": "Введите email",
            "invalid": "Введите корректный email",
            "required": "Введите email",
        },
    )
    password = serializers.CharField(
        write_only=True,
        error_messages={
            "blank": "Введите пароль",
            "required": "Введите пароль",
        },
    )

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            raise serializers.ValidationError({"email": "Пользователь с таким email не зарегистрирован"})
        if not user.check_password(password):
            raise serializers.ValidationError({"password": "Неверный пароль"})
        if user.is_blocked:
            raise serializers.ValidationError({"email": "Аккаунт заблокирован администратором"})
        if not user.is_active:
            raise serializers.ValidationError({"email": "Аккаунт отключен"})

        attrs["user"] = user
        return attrs


class VerificationRequestSerializer(serializers.Serializer):
    status = serializers.CharField(read_only=True)

    def save(self, **kwargs):
        user = self.context["request"].user

        if user.verification_status == User.VerificationStatus.APPROVED:
            return user

        user.verification_status = User.VerificationStatus.PENDING
        user.save(update_fields=["verification_status"])
        return user
