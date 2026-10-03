from decimal import Decimal
from django.test import TransactionTestCase
from django.utils import timezone
from apps.accounts.models import Permission, RolePermission
from apps.finance.tests.test_concurrency import LedgerConcurrencyTests
from apps.inventory.models import Product, Warehouse, StockLevel, StockMovement
from apps.inventory.stock import create_stock_movement
from apps.inventory.transfer_services import create_stock_transfer, transition_stock_transfer
from apps.purchasing.services import receive_purchase_order


class StockConcurrencyTests(TransactionTestCase):
    race = LedgerConcurrencyTests.race

    def setUp(self):
        LedgerConcurrencyTests.setUp(self)
        role = self.membership.membership_roles.select_related("role").first().role
        for code in ("inventory.movements.create", "inventory.transfers.create", "inventory.transfers.approve"):
            permission, _ = Permission.objects.get_or_create(code=code, defaults=dict(label=code, module="inventory", action=code.rsplit(".", 1)[-1]))
            RolePermission.objects.get_or_create(role=role, permission=permission)
        self.product = Product.objects.create(company=self.company, name="Stock", reference="S", purchase_price=Decimal("100.00"))
        self.warehouse = self.order.warehouse
        self.destination = Warehouse.objects.create(company=self.company, name="Destination", code="D")
        self.move("10.000", "in", "initial-stock")

    def move(self, quantity, kind, key):
        return create_stock_movement(company=self.company, membership=self.membership, key=key,
            data=dict(product_id=self.product.pk, warehouse_id=self.warehouse.pk, quantity=Decimal(quantity), type=kind, date=timezone.localdate()))

    def ready_transfer(self):
        transfer = create_stock_transfer(company=self.company, membership=self.membership, key="transfer-create",
            data=dict(source_warehouse_id=self.warehouse.pk, destination_warehouse_id=self.destination.pk, date=timezone.localdate(),
                reference_external="", notes="", lines=[dict(product_id=self.product.pk, quantity=Decimal("7.000"))]))
        for action in ("ready", "start"):
            transition_stock_transfer(company=self.company, membership=self.membership, transfer_id=transfer.pk, action=action)
        return transfer

    def test_concurrent_issues_prevent_negative_stock(self):
        self.assertEqual(self.race(lambda n: self.move("7.000", "out", f"concurrent-issue-{n}")), [200, 409])
        self.assertEqual(StockLevel.objects.get(product=self.product, warehouse=self.warehouse).quantity_on_hand, 3)
        self.assertEqual(StockMovement.objects.count(), 2)

    def test_duplicate_movement_same_key_only_once(self):
        self.assertEqual(self.race(lambda _: self.move("1.250", "in", "duplicate-movement")), [200, 200])
        self.assertEqual(StockLevel.objects.get(product=self.product, warehouse=self.warehouse).quantity_on_hand, Decimal("11.250"))
        self.assertEqual(StockMovement.objects.count(), 2)

    def test_double_transfer_completion_only_once(self):
        transfer = self.ready_transfer()
        self.assertEqual(self.race(lambda _: transition_stock_transfer(company=self.company, membership=self.membership, transfer_id=transfer.pk, action="complete")), [200, 409])
        self.assertEqual(StockLevel.objects.get(product=self.product, warehouse=self.warehouse).quantity_on_hand, 3)
        self.assertEqual(StockLevel.objects.get(product=self.product, warehouse=self.destination).quantity_on_hand, 7)
        self.assertEqual(StockMovement.objects.count(), 3)

    def test_issue_racing_transfer_cannot_spend_same_stock(self):
        transfer = self.ready_transfer()
        def action(index):
            if index:
                self.move("7.000", "out", "competing-issue")
            else:
                transition_stock_transfer(company=self.company, membership=self.membership, transfer_id=transfer.pk, action="complete")
        self.assertEqual(self.race(action), [200, 409])
        self.assertEqual(StockLevel.objects.get(product=self.product, warehouse=self.warehouse).quantity_on_hand, 3)

    def test_duplicate_receipt_posts_one_stock_movement(self):
        self.order_line.product = self.product
        self.order_line.save(update_fields=["product"])
        self.assertEqual(self.race(lambda _: receive_purchase_order(company=self.company, membership=self.membership, order_id=self.order.pk,
            data=dict(date=timezone.localdate(), warehouse=self.warehouse.name, lines=[dict(line_id=self.order_line.pk, quantity=Decimal("2.000"))]), key="same-stock-receipt")), [200, 200])
        self.assertEqual(StockLevel.objects.get(product=self.product, warehouse=self.warehouse).quantity_on_hand, 12)
        self.assertEqual(StockMovement.objects.filter(receipt_line__isnull=False).count(), 1)
