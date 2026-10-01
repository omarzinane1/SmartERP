import importlib
import json
from pathlib import Path

from django.db import connection
from django.db.migrations.loader import MigrationLoader
from django.test import TestCase

from apps.accounts.models import MembershipRole, Permission, Role, RolePermission

from .support import RBACDataMixin


AUDITED_CODES = json.loads(
    (Path(__file__).parent / "fixtures" / "permission_codes.json").read_text(encoding="utf-8")
)
NON_GRANTABLE = {"users.manage", "roles.manage", "roles.assign", "audit.export"}


class PermissionCatalogTests(RBACDataMixin, TestCase):
    def assert_catalog(self):
        permissions = list(Permission.objects.order_by("code"))
        self.assertEqual(len(AUDITED_CODES), 82)
        self.assertEqual([permission.code for permission in permissions], AUDITED_CODES)
        self.assertEqual(Permission.objects.filter(is_active=True).count(), 82)
        self.assertSetEqual(
            set(Permission.objects.filter(is_grantable=False).values_list("code", flat=True)),
            NON_GRANTABLE,
        )
        for permission in permissions:
            with self.subTest(code=permission.code):
                module, action = permission.code.split(".", 1)
                self.assertEqual(permission.label, permission.code)
                self.assertEqual(permission.module, module)
                self.assertEqual(permission.action, action)
                self.assertEqual(permission.is_grantable, permission.code not in NON_GRANTABLE)

    def test_migrations_seed_the_complete_audited_catalog(self):
        self.assert_catalog()

    def test_completion_repairs_a_partial_catalog_idempotently_without_changing_grants(self):
        # Only the disposable test database is altered to reproduce a 48-row seed.
        keep = AUDITED_CODES[:48]
        self.assertIn("customers.view", keep)
        self.assertIn("invoices.view", keep)
        Permission.objects.exclude(code__in=keep).delete()
        self.assertEqual(Permission.objects.count(), 48)
        Permission.objects.filter(code="customers.view").update(
            label="Stale label", module="wrong", action="wrong", is_active=False,
        )
        Permission.objects.filter(code="audit.export").update(is_grantable=True)
        existing_ids = dict(Permission.objects.values_list("code", "id"))
        roles = list(Role.objects.order_by("id").values())
        grants = list(RolePermission.objects.order_by("id").values())
        assignments = list(MembershipRole.objects.order_by("id").values())

        migration = importlib.import_module(
            "apps.accounts.migrations.0004_complete_permission_catalog"
        )
        historical_apps = MigrationLoader(connection).project_state([
            ("accounts", "0003_seed_permission_catalog"),
        ]).apps
        self.assertIsNot(historical_apps.get_model("accounts", "Permission"), Permission)
        for run in range(2):
            with self.subTest(run=run), connection.schema_editor() as schema_editor:
                migration.complete_permission_catalog(historical_apps, schema_editor)
            self.assert_catalog()
            current_ids = dict(Permission.objects.values_list("code", "id"))
            for code, pk in existing_ids.items():
                self.assertEqual(current_ids[code], pk)
            existing_ids = current_ids
            self.assertEqual(list(Role.objects.order_by("id").values()), roles)
            self.assertEqual(list(RolePermission.objects.order_by("id").values()), grants)
            self.assertEqual(list(MembershipRole.objects.order_by("id").values()), assignments)
