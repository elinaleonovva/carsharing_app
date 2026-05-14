from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = "Create or update a user for Schemathesis API fuzzing and print an auth token."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="fuzz@example.com")
        parser.add_argument("--password", default="FuzzPass123")
        parser.add_argument("--admin", action="store_true")

    def handle(self, *args, **options):
        User = get_user_model()
        email = options["email"].strip().lower()
        is_admin = options["admin"]
        user, _ = User.objects.get_or_create(email=email)

        user.username = user.username or email.split("@", 1)[0]
        user.verification_status = User.VerificationStatus.APPROVED
        user.balance = Decimal("1000.00")
        user.role = User.Role.ADMIN if is_admin else User.Role.USER
        user.is_staff = is_admin
        user.is_superuser = is_admin
        user.is_blocked = False
        user.set_password(options["password"])
        user.save()

        token, _ = Token.objects.get_or_create(user=user)
        self.stdout.write(token.key)
