from .models import Permission, Role


def get_membership_roles(*, membership):
    """
    Return all active roles assigned to a membership.
    """

    return (
        Role.objects
        .filter(
            membership_roles__membership=membership,
            company=membership.company,
            is_active=True,
        )
        .distinct()
        .order_by("name")
    )


def get_membership_role_names(*, membership):
    """
    Return role names assigned to the membership.
    """

    return list(
        get_membership_roles(
            membership=membership,
        ).values_list(
            "name",
            flat=True,
        )
    )


def get_effective_permission_codes(*, membership):
    """
    Return the union of all active permissions
    granted through the membership's active roles.
    """

    return list(
        Permission.objects
        .filter(
            role_permissions__role__membership_roles__membership=membership,
            role_permissions__role__company=membership.company,
            role_permissions__role__is_active=True,
            is_active=True,
        )
        .values_list(
            "code",
            flat=True,
        )
        .distinct()
        .order_by("code")
    )

def membership_has_permission(*, membership, permission_code):
    """
    Check whether a membership has an active permission
    through at least one active role.
    """

    if membership is None:
        return False

    return Permission.objects.filter(
        code=permission_code,
        is_active=True,
        role_permissions__role__membership_roles__membership=membership,
        role_permissions__role__company=membership.company,
        role_permissions__role__is_active=True,
    ).exists()

def get_membership_role_display(*, membership):
    """
    Return a display-friendly representation of the
    membership's assigned roles.

    Authorization must never depend on this string.
    """

    role_names = get_membership_role_names(
        membership=membership,
    )

    if not role_names:
        return "User"

    if len(role_names) == 1:
        return role_names[0]

    return ", ".join(role_names)