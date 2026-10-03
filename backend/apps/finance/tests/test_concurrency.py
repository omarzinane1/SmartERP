from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from django.db import connections
from django.test import TransactionTestCase
from django.utils import timezone
from apps.accounts.models import User, Membership, Role, Permission, RolePermission, MembershipRole
from apps.companies.models import Company
from apps.crm.models import Customer
from apps.inventory.models import Warehouse
from apps.sales.models import Invoice, InvoiceLine, CreditNote
from apps.sales.invoice_workflows import post_invoice, create_credit_note
from apps.finance.models import Payment, PaymentAllocation
from apps.finance.services import allocate_payment
from apps.purchasing.models import Supplier, PurchaseOrder, PurchaseOrderLine, GoodsReceipt
from apps.purchasing.services import receive_purchase_order, transition_purchase_order
from common.exceptions import BusinessConflict


class LedgerConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.company = Company.objects.create(name="Concurrent ledger")
        self.user = User.objects.create_user(email="ledger@example.test")
        self.membership = Membership.objects.create(company=self.company, user=self.user)
        role = Role.objects.create(company=self.company, name="Ledger", code="ledger")
        MembershipRole.objects.create(membership=self.membership, role=role)
        for code in ("invoices.post", "invoices.credit_note", "payments.create", "purchases.confirm", "receipts.create"):
            p, _ = Permission.objects.get_or_create(code=code, defaults=dict(label=code, module=code.split('.')[0], action=code.split('.')[1]))
            RolePermission.objects.create(role=role, permission=p)
        customer = Customer.objects.create(company=self.company, reference="C1", name="Client", type="company", city="Rabat", email="client@example.test")
        self.invoice = Invoice.objects.create(company=self.company, customer=customer, salesperson=self.membership, number="I1",
            issue_date=timezone.localdate(), due_date=timezone.localdate(), total=100, subtotal=100, gross_total=100, balance_due=100)
        self.line = dict(company=self.company, position=1, product_name="Service", quantity=Decimal("10.000"), unit_price=Decimal("10.00"),
                         gross_total=Decimal("100.00"), discount_total=Decimal("0.00"), subtotal=Decimal("100.00"), tax_total=Decimal("0.00"), line_total=Decimal("100.00"))
        InvoiceLine.objects.create(invoice=self.invoice, **self.line)
        self.payment = Payment.objects.create(company=self.company, customer=customer, number="P1", direction="incoming", amount=100,
            date=timezone.localdate(), currency="MAD", method="cash", created_by=self.user, operation_key="created-payment", request_fingerprint="x")
        warehouse = Warehouse.objects.create(company=self.company, code="W", name="Main")
        supplier = Supplier.objects.create(company=self.company, reference="S1", name="Supplier", category="Services", country="Maroc", city="Rabat", buyer=self.membership)
        self.order = PurchaseOrder.objects.create(company=self.company, supplier=supplier, buyer=self.membership, warehouse=warehouse,
            number="PO1", date=timezone.localdate(), expected_date=timezone.localdate(), created_by=self.user, status="confirmed", total=100, subtotal=100, gross_total=100)
        self.order_line = PurchaseOrderLine.objects.create(order=self.order, **self.line)

    def race(self, action):
        barrier = Barrier(2)
        def worker(index):
            try:
                barrier.wait(timeout=15)
                action(index)
                return 200
            except BusinessConflict:
                return 409
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return sorted(pool.map(worker, range(2)))

    def test_simultaneous_posting_only_once(self):
        self.assertEqual(self.race(lambda _: post_invoice(company=self.company, membership=self.membership, invoice_id=self.invoice.pk)), [200, 409])
        self.assertEqual(self.invoice.activities.filter(type="posted").count(), 1)

    def test_simultaneous_allocations_cannot_overallocate(self):
        Invoice.objects.filter(pk=self.invoice.pk).update(status="posted")
        self.assertEqual(self.race(lambda n: allocate_payment(company=self.company, membership=self.membership, payment_id=self.payment.pk,
            invoice_id=self.invoice.pk, amount=Decimal("75.00"), key=f"allocation-{n}")), [200, 409])
        self.invoice.refresh_from_db()
        self.assertEqual((self.invoice.amount_paid, self.invoice.balance_due), (75, 25))
        self.assertEqual(PaymentAllocation.objects.count(), 1)

    def test_concurrent_duplicate_allocation_replays(self):
        Invoice.objects.filter(pk=self.invoice.pk).update(status="posted")
        self.assertEqual(self.race(lambda _: allocate_payment(company=self.company, membership=self.membership, payment_id=self.payment.pk,
            invoice_id=self.invoice.pk, amount=Decimal("25.00"), key="same-allocation")), [200, 200])
        self.assertEqual(PaymentAllocation.objects.count(), 1)

    def test_simultaneous_full_credit_only_once(self):
        Invoice.objects.filter(pk=self.invoice.pk).update(status="posted")
        self.assertEqual(self.race(lambda n: create_credit_note(company=self.company, membership=self.membership, invoice_id=self.invoice.pk,
            data=dict(date=timezone.localdate(), reason="Return"), key=f"credit-race-{n}")), [200, 409])
        self.assertEqual(CreditNote.objects.count(), 1)

    def test_simultaneous_confirmation_only_once(self):
        PurchaseOrder.objects.filter(pk=self.order.pk).update(status="draft")
        self.assertEqual(self.race(lambda _: transition_purchase_order(company=self.company, membership=self.membership, order_id=self.order.pk, action="confirm")), [200, 409])

    def test_simultaneous_receipts_cannot_overreceive(self):
        self.assertEqual(self.race(lambda n: receive_purchase_order(company=self.company, membership=self.membership, order_id=self.order.pk,
            data=dict(date=timezone.localdate(), warehouse="Main", lines=[dict(line_id=self.order_line.pk, quantity=Decimal("7.000"))]), key=f"receipt-race-{n}")), [200, 409])
        self.order_line.refresh_from_db()
        self.assertEqual(self.order_line.received_quantity, 7)
        self.assertEqual(GoodsReceipt.objects.count(), 1)

    def test_concurrent_duplicate_receipt_replays(self):
        self.assertEqual(self.race(lambda _: receive_purchase_order(company=self.company, membership=self.membership, order_id=self.order.pk,
            data=dict(date=timezone.localdate(), warehouse="Main", lines=[dict(line_id=self.order_line.pk, quantity=Decimal("2.000"))]), key="same-receipt")), [200, 200])
        self.order_line.refresh_from_db()
        self.assertEqual(self.order_line.received_quantity, 2)
        self.assertEqual(GoodsReceipt.objects.count(), 1)
