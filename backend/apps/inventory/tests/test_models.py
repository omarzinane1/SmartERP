from django.db import IntegrityError, transaction
from django.test import TestCase

from apps.companies.models import Company
from apps.inventory.models import Warehouse


class WarehouseIsolationTests(TestCase):
    def test_code_is_unique_per_company(self):
        company = Company.objects.create(name="A")
        Warehouse.objects.create(company=company, code="MAIN", name="First")
        with self.assertRaises(IntegrityError), transaction.atomic():
            Warehouse.objects.create(company=company, code="MAIN", name="Duplicate")

    def test_companies_can_use_the_same_code(self):
        for name in ("A", "B"):
            company = Company.objects.create(name=name)
            Warehouse.objects.create(company=company, code="MAIN", name="Main")
        self.assertEqual(Warehouse.objects.filter(code="MAIN").count(), 2)
