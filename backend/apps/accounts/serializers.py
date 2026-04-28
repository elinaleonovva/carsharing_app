import re

from rest_framework import serializers

from .models import User


PHONE_ALLOWED_RE = re.compile(r"^\d+$")
DRIVER_LICENSE_SERIES_RE = re.compile(r"^[0-9A-Za-zА-Яа-яЁё]{4}$")
PERSON_NAME_RE = re.compile(r"^[A-Za-zА-Яа-яЁё]+(?:[ -][A-Za-zА-Яа-яЁё]+)*$")


def clean_message(message: str) -> str:
    return message.strip().rstrip(".!?")


def validate_phone_number(value: str) -> str:
    phone = value.strip()

    if not phone:
        raise serializers.ValidationError("Введите номер телефона")
    if not PHONE_ALLOWED_RE.fullmatch(phone):
        raise serializers.ValidationError("Номер телефона должен содержать только цифры")
    if len(phone) != 11:
        raise serializers.ValidationError("Номер телефона должен содержать 11 цифр")

    return phone


def validate_person_name(value: str, field_label: str) -> str:
    normalized = re.sub(r"\s+", " ", value.strip())

    if not normalized:
        raise serializers.ValidationError(f"Введите {field_label}")

    if not PERSON_NAME_RE.fullmatch(normalized):
        raise serializers.ValidationError(
            f"{field_label.capitalize()} может содержать только буквы, пробел и дефис"
        )

    return normalized


def normalize_driver_license(value: str) -> str:
    compact = re.sub(r"\s+", "", value.strip()).upper()

    if len(compact) != 10:
        raise serializers.ValidationError("Введите номер водительского удостоверения в формате XX XX YYYYYY")

    series = compact[:4]
    number = compact[4:]

    if not DRIVER_LICENSE_SERIES_RE.fullmatch(series) or not number.isdigit():
        raise serializers.ValidationError("Введите номер водительского удостоверения в формате XX XX YYYYYY")

    is_digit_series = bool(re.fullmatch(r"\d{4}", series))
    is_mixed_series = bool(re.fullmatch(r"\d{2}[A-Za-zА-Яа-яЁё]{2}", series))

    if not (is_digit_series or is_mixed_series):
        raise serializers.ValidationError("Серия ВУ должна содержать 4 цифры или 2 цифры и 2 буквы")

    return f"{series[:2]} {series[2:]} {number}"


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
            "patronymic",
            "phone",
            "driver_license_number",
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

    def validate_first_name(self, value):
        return validate_person_name(value, "имя")

    def validate_last_name(self, value):
        return validate_person_name(value, "фамилию")

    def validate_patronymic(self, value):
        return validate_person_name(value, "отчество")

    def validate_phone(self, value):
        return validate_phone_number(value)

    def validate_driver_license_number(self, value):
        driver_license_number = normalize_driver_license(value)
        queryset = User.objects.filter(driver_license_number=driver_license_number)

        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)

        if queryset.exists():
            raise serializers.ValidationError("Пользователь с таким водительским удостоверением уже зарегистрирован")

        return driver_license_number


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
        error_messages={
            "blank": "Введите пароль",
            "required": "Введите пароль",
        },
    )
    password_confirm = serializers.CharField(
        write_only=True,
        error_messages={
            "blank": "Повторите пароль",
            "required": "Повторите пароль",
        },
    )
    first_name = serializers.CharField(
        required=True,
        allow_blank=False,
        error_messages={
            "blank": "Введите имя",
            "required": "Введите имя",
        },
    )
    last_name = serializers.CharField(
        required=True,
        allow_blank=False,
        error_messages={
            "blank": "Введите фамилию",
            "required": "Введите фамилию",
        },
    )
    patronymic = serializers.CharField(
        required=True,
        allow_blank=False,
        error_messages={
            "blank": "Введите отчество",
            "required": "Введите отчество",
        },
    )
    phone = serializers.CharField(
        required=True,
        allow_blank=False,
        error_messages={
            "blank": "Введите номер телефона",
            "required": "Введите номер телефона",
        },
    )
    driver_license_number = serializers.CharField(
        required=True,
        allow_blank=False,
        error_messages={
            "blank": "Введите номер водительского удостоверения",
            "required": "Введите номер водительского удостоверения",
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
            "patronymic",
            "phone",
            "driver_license_number",
        )

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают"})

        return attrs

    def validate_email(self, value):
        email = value.strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован")
        return email

    def validate_first_name(self, value):
        return validate_person_name(value, "имя")

    def validate_last_name(self, value):
        return validate_person_name(value, "фамилию")

    def validate_patronymic(self, value):
        return validate_person_name(value, "отчество")

    def validate_phone(self, value):
        return validate_phone_number(value)

    def validate_driver_license_number(self, value):
        driver_license_number = normalize_driver_license(value)
        if User.objects.filter(driver_license_number=driver_license_number).exists():
            raise serializers.ValidationError("Пользователь с таким водительским удостоверением уже зарегистрирован")
        return driver_license_number

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.verification_status = User.VerificationStatus.PENDING
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
        if user.verification_status == User.VerificationStatus.PENDING:
            raise serializers.ValidationError({"email": "Заявка еще не подтверждена администратором"})
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
