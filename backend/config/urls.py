import os

from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView


urlpatterns = [
    path("", RedirectView.as_view(url=os.getenv("FRONTEND_URL", "http://localhost:5173/"), permanent=False)),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.rentals.urls")),
    path("admin/", admin.site.urls),
]
