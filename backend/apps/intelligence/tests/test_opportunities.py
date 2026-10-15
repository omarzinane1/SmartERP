from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from uuid import uuid4
from unittest.mock import patch
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone
from apps.accounts.models import Permission, RolePermission
from apps.audit.models import AuditLog
from apps.crm.models import Customer
from apps.sales.models import SalesOrder, Invoice, CreditNote
from apps.inventory.models import StockMovement, StockLevel
from apps.notifications.models import BusinessEmail, Notification
from common.dates import company_today
from common.tests.async_support import AsyncDataMixin
from apps.intelligence.models import AIOpportunity, IntelligenceRun
from apps.intelligence.opportunity_detectors import DETECTORS, detect_company_opportunities
from apps.intelligence.tasks import run_company_intelligence


class OpportunityTests(AsyncDataMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for code in ["ai.use", "ai.opportunities.view", "customers.view"]:
            RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code=code))

    def order(self, age=100, customer=None, **kwargs):
        return SalesOrder.objects.create(company=self.company, customer=customer or self.customer, salesperson=self.membership,
            number=str(uuid4()), status="confirmed", confirmed_at=datetime.combine(company_today(self.company)-timedelta(days=age), time(12), tzinfo=ZoneInfo(self.company.timezone)), subtotal="125.25", total="125.25", **kwargs)

    def historic(self):
        for age in [120, 110, 90]:
            self.order(age)

    def scan(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post("/api/ai/control-center/refresh/")
            self.assertEqual(response.status_code, 202, response.data)
        run = IntelligenceRun.objects.get(pk=response.data["id"])
        self.assertEqual(run.status, "completed", run.error_code)
        return run

    def detect(self, kind):
        return DETECTORS[kind](self.company, company_today(self.company))

    def opportunity(self):
        self.historic()
        self.assertEqual(len(self.detect("customer_reactivation")), 1)
        run = self.scan()
        self.assertIn("opportunity:customer_reactivation", run.rules)
        self.assertTrue(AIOpportunity.objects.filter(opportunity_type="customer_reactivation").exists(), run.summary)
        return AIOpportunity.objects.get(opportunity_type="customer_reactivation")

    def aged_invoice(self, **kwargs):
        obj = self.invoice(overdue=True, **kwargs)
        Invoice.objects.filter(pk=obj["id"]).update(issue_date=company_today(self.company)-timedelta(days=75), due_date=company_today(self.company)-timedelta(days=60))
        return Invoice.objects.get(pk=obj["id"])

    def test_reactivation_threshold_recent_activity_and_currency(self):
        self.order(120); self.order(110)
        self.assertEqual(self.detect("customer_reactivation"), [])
        self.order(90)
        row = self.detect("customer_reactivation")[0]
        self.assertEqual(row["metadata"]["metrics"]["days_inactive"], 90)
        self.assertIsNone(row["estimated_value"])
        self.assertIsNone(row["confidence"])
        self.order(1, currency="EUR")
        self.assertEqual(len(self.detect("customer_reactivation")), 1)
        self.order(1)
        self.assertEqual(self.detect("customer_reactivation"), [])

    def test_reactivation_drafts_old_history_and_foreign_relations_excluded(self):
        self.historic()
        SalesOrder.objects.update(status="draft")
        self.assertEqual(self.detect("customer_reactivation"), [])
        SalesOrder.objects.update(status="confirmed", customer=self.foreign_customer)
        self.assertEqual(self.detect("customer_reactivation"), [])
        SalesOrder.objects.update(customer=self.customer, salesperson=self.other_membership)
        self.assertEqual(self.detect("customer_reactivation"), [])
        SalesOrder.objects.update(salesperson=self.membership, confirmed_at=timezone.now()-timedelta(days=366))
        self.assertEqual(self.detect("customer_reactivation"), [])

    def test_company_timezone_for_order_boundary(self):
        from datetime import datetime, timezone as utc
        self.company.timezone = "Asia/Tokyo"
        self.company.save(update_fields=["timezone"])
        self.historic()
        SalesOrder.objects.update(confirmed_at=datetime(2026, 7, 13, 16, tzinfo=utc.utc))
        from datetime import date
        # Local July 14 is only 89 days before October 11, not 90.
        self.assertEqual(DETECTORS["customer_reactivation"](self.company, date(2026, 10, 11)), [])

    def test_inactivity_boundary_across_utc_midnight(self):
        from datetime import timezone as utc
        for moment in [datetime(2026, 10, 12, 22, 30, tzinfo=utc.utc), datetime(2026, 10, 12, 23, 30, tzinfo=utc.utc)]:
            with self.subTest(moment=moment), patch("django.utils.timezone.now", return_value=moment):
                self.historic()
                rows = self.detect("customer_reactivation")
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["metadata"]["metrics"]["days_inactive"], 90)
                SalesOrder.objects.all().delete()

    def test_receivables_grouping_exact_value_and_payment_recovery(self):
        a = self.aged_invoice(price="125.25", quantity="1.000")
        b = self.aged_invoice(price="24.75", quantity="1.000")
        rows = self.detect("receivable_collection")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["estimated_value"], Decimal("150.00"))
        self.assertEqual(rows[0]["metadata"]["metrics"]["invoices_count"], 2)
        self.assertEqual(rows[0]["priority"], "high")
        for inv in [a, b]:
            Invoice.objects.filter(pk=inv.pk).update(balance_due=0, amount_paid=inv.total)
        self.assertEqual(self.detect("receivable_collection"), [])

    def test_receivables_materiality_age_and_foreign_customer(self):
        a = self.aged_invoice(price="1", quantity="1")
        other = Customer.objects.create(company=self.company, reference="SECOND", name="Second")
        b = self.aged_invoice(price="100", quantity="1")
        Invoice.objects.filter(pk=b.pk).update(customer=other)
        self.assertEqual([r["entity_id"] for r in self.detect("receivable_collection")], [other.pk])
        Invoice.objects.filter(pk=b.pk).update(customer=self.foreign_customer)
        self.assertEqual([r["entity_id"] for r in self.detect("receivable_collection")], [self.customer.pk])
        Invoice.objects.filter(pk=a.pk).update(due_date=company_today(self.company)-timedelta(days=29))
        self.assertEqual(self.detect("receivable_collection"), [])

    def test_customer_value_cohort_percentile_and_net_credits(self):
        day = company_today(self.company)
        for i in range(10):
            customer = self.customer if i == 9 else Customer.objects.create(company=self.company, reference=f"C{i}", name=f"C{i}")
            for j in range(3):
                amount = Decimal("1000") if i == 9 else Decimal("100")
                Invoice.objects.create(company=self.company, customer=customer, salesperson=self.membership, number=f"V{i}-{j}",
                    issue_date=day, due_date=day, status="posted", currency="MAD", subtotal=amount, total=amount, balance_due=amount)
        rows = self.detect("high_value_customer")
        self.assertEqual([r["entity_id"] for r in rows], [self.customer.pk])
        self.assertEqual(Decimal(rows[0]["metadata"]["metrics"]["revenue_ht"]), 3000)
        self.assertIsNone(rows[0]["estimated_value"])
        for inv in Invoice.objects.filter(customer=self.customer):
            CreditNote.objects.create(company=self.company, customer=self.customer, original_invoice=inv, number=f"CN{inv.pk}", date=day,
                currency="MAD", created_by=self.user, operation_key=str(uuid4()), subtotal=950, total=950, gross_total=950, discount_total=0, tax_total=0)
        self.assertEqual(self.detect("high_value_customer"), [])

    def test_insufficient_data_produces_no_opportunities(self):
        self.invoice()
        self.assertEqual(detect_company_opportunities(company=self.company, kinds=list(DETECTORS), as_of=company_today(self.company)), [])

    def test_replenishment_requires_three_issue_days_and_low_stock(self):
        product = self.product()
        self.assertEqual(self.movement(product, quantity="30", date=(company_today(self.company)-timedelta(days=4)).isoformat()).status_code, 201)
        for age in [3, 2, 1]:
            self.assertEqual(self.movement(product, quantity="9", type="out", date=(company_today(self.company)-timedelta(days=age)).isoformat()).status_code, 201)
        rows = self.detect("stock_replenishment")
        self.assertEqual(len(rows), 1)
        self.assertEqual(Decimal(rows[0]["metadata"]["metrics"]["review_quantity"]), 24)
        self.assertEqual(rows[0]["source"], "rule_based")
        self.assertIsNone(rows[0]["estimated_value"])
        StockMovement.objects.filter(movement_type="issue").update(date=company_today(self.company))
        self.assertEqual(self.detect("stock_replenishment"), [])
        self.movement(product, quantity="50")
        self.assertEqual(self.detect("stock_replenishment"), [])

    def test_dormant_stock_known_old_history_and_exact_book_value(self):
        product = self.product()
        self.assertEqual(self.movement(product, quantity="7.5", date=(company_today(self.company)-timedelta(days=91)).isoformat()).status_code, 201)
        rows = self.detect("dormant_stock")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["estimated_value"], StockLevel.objects.get(product_id=product["id"]).total_value)
        self.assertEqual(rows[0]["metadata"]["value_kind"], "book_inventory_value")
        self.movement(product, quantity="1")
        self.assertEqual(self.detect("dormant_stock"), [])

    def test_dormant_unknown_history_is_not_invented(self):
        product = self.product()
        StockLevel.objects.create(company=self.company, product_id=product["id"], warehouse=self.warehouse, quantity_on_hand=10, total_value=100)
        self.assertEqual(self.detect("dormant_stock"), [])

    def test_scan_deduplication_suppression_and_recurrence(self):
        obj = self.opportunity()
        self.scan()
        self.assertEqual(AIOpportunity.objects.count(), 1)
        self.assertEqual(self.post(f"/api/ai/opportunities/{obj.pk}/dismiss/").status_code, 200)
        self.scan()
        self.assertEqual(AIOpportunity.objects.count(), 1)
        new_order = self.order(1)
        self.scan()
        obj.refresh_from_db()
        self.assertFalse(obj.condition_active)
        SalesOrder.objects.filter(pk=new_order.pk).update(status="cancelled")
        self.scan()
        self.assertEqual(AIOpportunity.objects.count(), 2)
        self.assertEqual(AIOpportunity.objects.filter(condition_active=True).count(), 1)

    def test_lifecycle_actor_audit_and_invalid_transitions(self):
        obj = self.opportunity()
        path = f"/api/ai/opportunities/{obj.pk}/"
        self.assertEqual(self.post(path+"complete/").status_code, 409)
        self.assertEqual(self.post(path+"acknowledge/").data["status"], "acknowledged")
        self.assertEqual(self.post(path+"acknowledge/").status_code, 200)
        self.assertEqual(AuditLog.objects.filter(action="intelligence.opportunity_acknowledged").count(), 1)
        self.assertEqual(self.post(path+"complete/").data["status"], "completed")
        self.assertEqual(self.post(path+"complete/").status_code, 200)
        self.assertEqual(self.post(path+"dismiss/").status_code, 409)
        obj.refresh_from_db()
        self.assertEqual(obj.acknowledged_by_id, self.user.pk)
        self.assertEqual(obj.completed_by_id, self.user.pk)
        self.assertIsNotNone(obj.completed_at)
        self.assertEqual(self.post(path+"assign/", {"user_id": self.user.pk}).status_code, 403)

    def test_condition_disappears_expires_without_claiming_completion(self):
        obj = self.opportunity()
        self.order(1)
        self.scan()
        obj.refresh_from_db()
        self.assertEqual(obj.status, "expired")
        self.assertIsNone(obj.completed_at)
        self.assertFalse(obj.condition_active)
        self.assertTrue(AuditLog.objects.filter(action="intelligence.opportunity_expired").exists())

    def test_ttl_expiry_detail_filter_actions_and_summary(self):
        obj = self.opportunity()
        AIOpportunity.objects.filter(pk=obj.pk).update(expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.client.get(f"/api/ai/opportunities/{obj.pk}/").data["status"], "expired")
        self.assertEqual(self.client.get("/api/ai/opportunities/?status=expired").data["count"], 1)
        self.assertEqual(self.client.get("/api/ai/control-center/").data["stats"]["opportunities"], 0)
        self.assertEqual(self.post(f"/api/ai/opportunities/{obj.pk}/acknowledge/").status_code, 409)
        self.scan()
        self.assertEqual(self.client.get(f"/api/ai/opportunities/{obj.pk}/").data["status"], "open")
        self.assertEqual(AIOpportunity.objects.count(), 1)

    def test_paginated_filters_and_metadata_allowlist(self):
        obj = self.opportunity()
        obj.metadata["secret"] = "hidden-secret"
        obj.metadata["metrics"]["raw_sql"] = "hidden-secret"
        obj.save()
        detail = self.client.get(f"/api/ai/opportunities/{obj.pk}/").data
        self.assertNotIn("hidden-secret", str(detail))
        self.assertEqual(detail["entity"]["path"], f"/customers/{self.customer.pk}")
        for query in ["status=open", "priority=medium", "domain=sales", "type=customer_reactivation", "search=Alpha", "page_size=1", f"date_from={company_today(self.company)}&date_to={company_today(self.company)}"]:
            self.assertEqual(self.client.get("/api/ai/opportunities/?"+query).data["count"], 1, query)
        for query in ["status=assigned", "type=upsell", "page_size=101", "date_from=2026-10-11&date_to=2026-10-10", "search="+"x"*151]:
            self.assertEqual(self.client.get("/api/ai/opportunities/?"+query).status_code, 400, query)
        self.assertEqual(self.client.get("/api/ai/opportunities/?company_id=2").status_code, 403)
        self.assertEqual(self.post(f"/api/ai/opportunities/{obj.pk}/acknowledge/", dict(company_id=2)).status_code, 403)

    def test_control_center_priority_top_five_total_and_pagination(self):
        obj = self.opportunity()
        clones = []
        for i in range(7):
            row = AIOpportunity.objects.get(pk=obj.pk)
            row.pk = None; row.fingerprint = f"test:{i}"; row.priority = "high" if i == 0 else "low"
            clones.append(row)
        AIOpportunity.objects.bulk_create(clones)
        center = self.client.get("/api/ai/control-center/").data
        self.assertEqual(center["stats"]["opportunities"], 8)
        self.assertEqual(len(center["opportunities"]), 5)
        self.assertEqual(center["opportunities"][0]["priority"], "high")
        page = self.client.get("/api/ai/opportunities/?page_size=3&page=3").data
        self.assertEqual(page["count"], 8)
        self.assertEqual(len(page["opportunities"]), 2)

    def test_foreign_company_and_corrupt_entity_are_invisible(self):
        obj = self.opportunity()
        for change in [dict(company=self.other_company), dict(company=self.company, entity_id=self.foreign_customer.pk)]:
            AIOpportunity.objects.filter(pk=obj.pk).update(**change)
            self.assertEqual(self.client.get(f"/api/ai/opportunities/{obj.pk}/").status_code, 404)
            self.assertEqual(self.post(f"/api/ai/opportunities/{obj.pk}/acknowledge/").status_code, 404)
            self.assertEqual(self.client.get("/api/ai/opportunities/").data["count"], 0)
            self.assertEqual(self.client.get("/api/ai/control-center/").data["stats"]["opportunities"], 0)

    def test_source_revocation_masks_details_actions_history_and_count(self):
        obj = self.opportunity()
        RolePermission.objects.filter(role=self.role, permission__code="sales.view").delete()
        self.assertEqual(self.client.get(f"/api/ai/opportunities/{obj.pk}/").status_code, 404)
        self.assertEqual(self.post(f"/api/ai/opportunities/{obj.pk}/dismiss/").status_code, 404)
        self.assertEqual(self.client.get("/api/ai/opportunities/").data["count"], 0)
        self.assertIsNone(self.client.get("/api/ai/control-center/").data["lastRun"]["summary"])

    def test_missing_opportunity_permission_superuser_has_no_bypass(self):
        self.user.is_superuser = True; self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code="ai.opportunities.view").delete()
        self.assertEqual(self.client.get("/api/ai/opportunities/").status_code, 403)
        self.assertEqual(self.client.get("/api/ai/opportunities/1/").status_code, 403)
        self.assertEqual(self.client.get("/api/ai/control-center/").data["opportunities"], [])

    def test_permission_revoked_after_queue_and_before_publication(self):
        self.historic()
        response = self.post("/api/ai/control-center/refresh/")
        def revoke(**kwargs):
            values = detect_company_opportunities(**kwargs)
            RolePermission.objects.filter(role=self.role, permission__code="ai.opportunities.view").delete()
            return values
        with patch("apps.intelligence.services.detect_company_opportunities", side_effect=revoke):
            self.assertEqual(run_company_intelligence.run(response.data["id"])["status"], "failed")
        self.assertFalse(AIOpportunity.objects.exists())
        self.assertEqual(IntelligenceRun.objects.get().error_code, "access_revoked")

    def test_failed_detector_rolls_back_every_supervision_result(self):
        self.historic(); self.aged_invoice()
        with patch("apps.intelligence.services.detect_company_opportunities", side_effect=RuntimeError("secret dataset")):
            with self.captureOnCommitCallbacks(execute=True):
                self.post("/api/ai/control-center/refresh/")
        from apps.intelligence.models import AIAlert
        self.assertEqual(IntelligenceRun.objects.get().status, "failed")
        self.assertFalse(AIAlert.objects.exists())
        self.assertFalse(AIOpportunity.objects.exists())
        self.assertNotIn("secret", IntelligenceRun.objects.get().error_message)

    def test_candidate_limit_keeps_previous_snapshot(self):
        obj = self.opportunity()
        with patch("apps.intelligence.opportunity_config.MAX_CANDIDATES", 0):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.post("/api/ai/control-center/refresh/")
        self.assertEqual(IntelligenceRun.objects.get(pk=response.data["id"]).error_code, "detection_limit")
        self.assertEqual(AIOpportunity.objects.get().pk, obj.pk)

    def test_unique_active_fingerprint_enforced_by_database(self):
        obj = self.opportunity()
        obj.pk = None
        with self.assertRaises(IntegrityError), transaction.atomic():
            obj.save()

    def test_no_business_changes_emails_or_opportunity_notifications(self):
        self.historic(); self.aged_invoice()
        before = (list(SalesOrder.objects.values()), list(Invoice.objects.values()), StockMovement.objects.count(), BusinessEmail.objects.count(), Notification.objects.count())
        self.scan()
        self.assertEqual(before, (list(SalesOrder.objects.values()), list(Invoice.objects.values()), StockMovement.objects.count(), BusinessEmail.objects.count(), Notification.objects.count()))
        self.assertTrue(AuditLog.objects.filter(action="intelligence.refresh_requested").exists())
