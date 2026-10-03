from rest_framework.permissions import BasePermission
from apps.accounts.services import can


class CanReadPurchases(BasePermission):
    def has_permission(self, request, view):
        return can(membership=getattr(request, "membership", None), permission_code="purchases.view")
