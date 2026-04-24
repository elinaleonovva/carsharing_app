import re
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        USER = "user", "Пользователь"
        ADMIN = "admin", "Администратор"

    class VerificationStatus(models.TextChoices):
        NOT_REQUESTED = "not_requested", "Не запрошено"
        PENDING = "pending", "На проверке"
        APPROVED = "approved", "Одобрено"
        REJECTED = "rejected", "Отклонено"

    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.USER,
    )
    email = models.EmailField("email address", unique=True)
    verification_status = models.CharField(
        max_length=24,
        choices=VerificationStatus.choices,
        default=VerificationStatus.NOT_REQUESTED,
    )
    phone = models.CharField(max_length=32, blank=True)
    balance = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    is_blocked = models.BooleanField(default=False)

    @property
    def is_verified(self) -> bool:
        return self.verification_status == self.VerificationStatus.APPROVED

    @property
    def can_use_service(self) -> bool:
        return self.is_active and not self.is_blocked and self.is_verified

    def generate_username(self) -> str:
        base_source = self.email.split("@", 1)[0] if self.email else "user"
        base = re.sub(r"[^A-Za-z0-9@.+_-]+", "-", base_source.lower()).strip("-._+")
        base = (base or "user")[:150]

        candidate = base
        counter = 1
        queryset = type(self).objects.all()
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        while queryset.filter(username__iexact=candidate).exists():
            suffix = f"-{counter}"
            candidate = f"{base[: 150 - len(suffix)]}{suffix}"
            counter += 1

        return candidate

    def save(self, *args, **kwargs):
        if self.email:
            self.email = self.email.strip().lower()
        if not self.username:
            self.username = self.generate_username()
        if self.is_staff or self.is_superuser:
            self.role = self.Role.ADMIN
        super().save(*args, **kwargs)
