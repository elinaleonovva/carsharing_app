from django.contrib import admin

from .models import Booking, Car, Tariff, TimeCoefficient, Trip, WalletTransaction


@admin.register(Car)
class CarAdmin(admin.ModelAdmin):
    list_display = ("brand", "model", "license_plate", "status", "latitude", "longitude")
    list_filter = ("status", "brand")
    search_fields = ("brand", "model", "license_plate")


admin.site.register(Tariff)
admin.site.register(TimeCoefficient)
admin.site.register(Booking)
admin.site.register(Trip)
admin.site.register(WalletTransaction)
