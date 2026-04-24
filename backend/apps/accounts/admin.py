from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        (
            "Carsharing profile",
            {
                "fields": (
                    "role",
                    "verification_status",
                    "patronymic",
                    "driver_license_number",
                    "phone",
                    "balance",
                    "is_blocked",
                )
            },
        ),
    )
    list_display = (
        "username",
        "email",
        "role",
        "verification_status",
        "is_blocked",
        "is_staff",
    )
    list_filter = ("role", "verification_status", "is_blocked", "is_staff", "is_active")
    search_fields = (
        "username",
        "email",
        "first_name",
        "last_name",
        "patronymic",
        "driver_license_number",
        "phone",
    )
