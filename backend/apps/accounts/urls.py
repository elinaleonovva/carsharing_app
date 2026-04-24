from django.urls import path

from .views import LoginAPIView, LogoutAPIView, MeAPIView, RegisterAPIView, VerificationRequestAPIView


urlpatterns = [
    path("register/", RegisterAPIView.as_view(), name="auth-register"),
    path("login/", LoginAPIView.as_view(), name="auth-login"),
    path("logout/", LogoutAPIView.as_view(), name="auth-logout"),
    path("me/", MeAPIView.as_view(), name="auth-me"),
    path("verification-request/", VerificationRequestAPIView.as_view(), name="auth-verification-request"),
]
