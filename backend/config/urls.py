import os

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.permissions import AllowAny, IsAdminUser


api_docs_permission_classes = [IsAdminUser] if settings.API_DOCS_REQUIRE_STAFF else [AllowAny]
api_docs_authentication_classes = [SessionAuthentication, TokenAuthentication]


urlpatterns = [
    path("", RedirectView.as_view(url=os.getenv("FRONTEND_URL", "http://localhost:5173/"), permanent=False)),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/", include("apps.rentals.urls")),
    path("admin/", admin.site.urls),
]

if settings.ENABLE_API_DOCS:
    swagger_view = SpectacularSwaggerView.as_view(
        url_name="api-schema",
        authentication_classes=api_docs_authentication_classes,
        permission_classes=api_docs_permission_classes,
    )

    urlpatterns += [
        path(
            "api/schema/",
            SpectacularAPIView.as_view(
                authentication_classes=api_docs_authentication_classes,
                permission_classes=api_docs_permission_classes,
            ),
            name="api-schema",
        ),
        path("api/swagger", swagger_view, name="api-swagger"),
        path("api/swagger/", swagger_view, name="api-swagger-slash"),
        path(
            "api/docs/",
            swagger_view,
            name="api-docs",
        ),
    ]
