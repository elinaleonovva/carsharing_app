from django.contrib import admin

from apps.rentals.models import BonusZone, Tariff, TimeCoefficient


admin.site.register(Tariff)
admin.site.register(TimeCoefficient)
admin.site.register(BonusZone)
