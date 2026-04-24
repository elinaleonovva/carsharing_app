from rest_framework.permissions import BasePermission


class IsNotBlocked(BasePermission):
    message = "Аккаунт заблокирован администратором."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and not request.user.is_blocked)


class IsAdminRole(BasePermission):
    message = "Доступ разрешен только администратору."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and not request.user.is_blocked
            and request.user.role == request.user.Role.ADMIN
        )
