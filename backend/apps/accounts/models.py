from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models

from common.models import TimeStampedModel


class UserManager(BaseUserManager):
    """
    Custom user manager using email instead of username.
    """

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("L'adresse email est obligatoire.")

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            **extra_fields,
        )

        user.set_password(password)
        user.save(using=self._db)

        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(
                "Le superuser doit avoir is_staff=True."
            )

        if extra_fields.get("is_superuser") is not True:
            raise ValueError(
                "Le superuser doit avoir is_superuser=True."
            )

        return self.create_user(
            email=email,
            password=password,
            **extra_fields,
        )


class User(AbstractUser, TimeStampedModel):
    """
    Global SmartERP user.

    Company access, roles and permissions are handled
    through Membership and RBAC models.
    """

    username = None

    email = models.EmailField(
        unique=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"
        ordering = ["-date_joined"]

    def __str__(self):
        return self.email


class MembershipStatus(models.TextChoices):
    INVITED = "invited", "Invité"
    ACTIVE = "active", "Actif"
    SUSPENDED = "suspended", "Suspendu"
    DISABLED = "disabled", "Désactivé"


class Membership(TimeStampedModel):
    """
    Links a User to a Company.

    Roles and permissions will be attached to the
    membership later through the RBAC system.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.CASCADE,
        related_name="memberships",
    )

    status = models.CharField(
        max_length=20,
        choices=MembershipStatus.choices,
        default=MembershipStatus.ACTIVE,
    )

    is_default = models.BooleanField(
        default=False,
    )

    class Meta:
        db_table = "accounts_membership"

        ordering = [
            "-created_at",
        ]

        constraints = [
            models.UniqueConstraint(
                fields=["user", "company"],
                name="unique_user_company_membership",
            ),
        ]

        indexes = [
            models.Index(
                fields=["user", "status"],
                name="membership_user_status_idx",
            ),
            models.Index(
                fields=["company", "status"],
                name="membership_company_status_idx",
            ),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.company.name}"