from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from decimal import Decimal
from threading import Barrier

from django.db import connections
from django.test import TransactionTestCase
from django.utils import timezone
from apps.accounts.models import Membership, MembershipRole, Permission, Role, RolePermission, User
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from apps.crm.models import Customer
from apps.sales.models import Quote, QuoteLine, SalesOrder
from apps.sales.order_services import convert_quote
from common.exceptions import BusinessConflict


class SalesConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Concurrency")
        self.user = User.objects.create_user(email="concurrency@example.test")
        self.membership = Membership.objects.create(company=self.company, user=self.user)
        role = Role.objects.create(company=self.company, name="Converter", code="converter")
        permission, _ = Permission.objects.get_or_create(code="quotes.convert", defaults=dict(label="quotes.convert", module="quotes", action="convert"))
        RolePermission.objects.create(role=role, permission=permission)
        MembershipRole.objects.create(membership=self.membership, role=role)

    def test_two_simultaneous_conversions_create_exactly_one_order(self):
        customer = Customer.objects.create(company=self.company, reference="C1", name="Customer", type="company", city="Rabat", email="customer@example.test")
        quote = Quote.objects.create(company=self.company, customer=customer, salesperson=self.membership, number="Q1", status="accepted",
                                     issue_date=timezone.localdate(), expires_at=timezone.localdate() + timedelta(days=1), gross_total=10, subtotal=10, total=10)
        QuoteLine.objects.create(company=self.company, quote=quote, position=1, description="Service", quantity=1, unit_price=10,
                                 gross_total=10, discount_total=0, subtotal=10, tax_total=0, line_total=10)
        barrier = Barrier(2)
        def convert():
            try:
                barrier.wait(timeout=10)
                convert_quote(company=self.company, membership=self.membership, quote_id=quote.pk)
                return 201
            except BusinessConflict:
                return 409
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: convert(), range(2)))
        self.assertEqual(sorted(results), [201, 409])
        self.assertEqual(SalesOrder.objects.filter(quote=quote).count(), 1)

    def test_parallel_number_allocation_has_no_duplicates(self):
        def number(_):
            try:
                return next_document_number(company=self.company, kind="invoice", prefix="INV")
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=4) as executor:
            numbers = list(executor.map(number, range(8)))
        self.assertEqual(len(set(numbers)), 8)
        self.assertTrue(any(number.endswith("0008") for number in numbers))
