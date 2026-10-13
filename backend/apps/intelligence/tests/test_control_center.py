from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from django.db import transaction
from django.test import TestCase
from django.utils import timezone
from kombu.exceptions import OperationalError
from apps.accounts.models import Permission, RolePermission
from apps.audit.models import AuditLog
from apps.finance.models import Payment
from apps.inventory.models import StockMovement, StockLevel
from apps.notifications.models import Notification, BusinessEmail
from apps.sales.models import Invoice
from common.tests.async_support import AsyncDataMixin
from apps.intelligence.models import AIAlert, IntelligenceRun
from apps.intelligence.services import claim_run, publish_signals
from apps.intelligence.tasks import run_company_intelligence


class ControlCenterTests(AsyncDataMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code="ai.use"))

    def run_analysis(self, key=None):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post("/api/ai/control-center/refresh/", key=key)
            self.assertEqual(response.status_code, 202, response.data)
        run = IntelligenceRun.objects.get(pk=response.data["id"])
        self.assertEqual(run.status, "completed", run.error_code)
        return run

    def dashboard(self):
        result = self.client.get("/api/ai/control-center/")
        self.assertEqual(result.status_code, 200, result.data)
        return result.data

    def signal(self):
        self.invoice(overdue=True)
        self.run_analysis()
        return AIAlert.objects.get(alert_type="overdue_invoice")

    def test_health_exact_healthy_and_no_invented_scores(self):
        self.invoice(overdue=False)
        data = self.dashboard()
        self.assertEqual(data["health"]["status"], "healthy")
        self.assertEqual(data["health"]["metrics"]["receivables"]["total"], Decimal("1000.00"))
        self.assertEqual(data["health"]["metrics"]["cashFlow"]["netCashFlow"], 0)
        self.assertIsNone(data["health"]["score"])
        self.assertIsNone(data["health"]["confidence"])
        self.assertIsNone(data["resolutionRate"])
        self.assertIsNone(data["responseMinutes"])
        self.assertEqual(data["capabilities"]["forecasts"], "not_available")
        self.assertEqual(data["alerts"], [])
        self.assertFalse(IntelligenceRun.objects.exists())  # GET never queues a scan.

    def test_real_rules_exact_metrics_and_no_erp_mutation(self):
        self.invoice(overdue=True)
        product = self.product()
        supplier = self.supplier()
        from apps.purchasing.models import Supplier
        Payment.objects.create(company=self.company, created_by=self.user, supplier=Supplier.objects.get(pk=supplier["id"]), direction="outgoing", status="completed", number="CASH-1", amount="300.00", currency="MAD", date=timezone.localdate(), method="bank_transfer")
        before = (list(Invoice.objects.values()), Payment.objects.count(), StockMovement.objects.count(), StockLevel.objects.count())
        self.run_analysis()
        data = self.dashboard()
        self.assertEqual(set(AIAlert.objects.values_list("alert_type", flat=True)), {"overdue_invoice", "low_stock", "negative_cash_flow"})
        self.assertEqual(data["health"]["status"], "critical")
        self.assertEqual(data["health"]["metrics"]["receivables"]["overdue"], Decimal("1000.00"))
        self.assertEqual(data["health"]["metrics"]["inventory"], dict(lowStock=1, outOfStock=1))
        self.assertEqual(data["health"]["metrics"]["cashFlow"]["netCashFlow"], Decimal("-300.00"))
        self.assertEqual(data["stats"]["critical"], 1)
        self.assertEqual(data["stats"]["warnings"], 2)
        self.assertEqual(data["stats"]["forecasts"], 0)  # Observations are not predictions.
        self.assertEqual(before, (list(Invoice.objects.values()), Payment.objects.count(), StockMovement.objects.count(), StockLevel.objects.count()))
        stock = AIAlert.objects.get(alert_type="low_stock")
        self.assertEqual(stock.entity_id, product["id"])
        self.assertIsNone(data["risks"][0]["probability"])

    def test_deduplication_suppression_auto_resolution_and_recurrence(self):
        obj = self.signal()
        self.run_analysis()
        self.assertEqual(AIAlert.objects.count(), 1)
        self.assertEqual(self.post(f"/api/ai/alerts/{obj.pk}/resolve/").status_code, 200)
        self.run_analysis()
        self.assertEqual(AIAlert.objects.count(), 1)  # Same unresolved ERP condition, manually handled.
        Invoice.objects.filter(pk=obj.entity_id).update(balance_due=0, amount_paid=1000)
        self.run_analysis()
        obj.refresh_from_db()
        self.assertFalse(obj.condition_active)
        Invoice.objects.filter(pk=obj.entity_id).update(balance_due=1000, amount_paid=0)
        self.run_analysis()
        self.assertEqual(AIAlert.objects.count(), 2)
        self.assertEqual(AIAlert.objects.filter(condition_active=True).count(), 1)

    def test_low_stock_recovery_closes_signal_without_inventory_write(self):
        product = self.product()
        self.run_analysis()
        self.assertEqual(self.movement(product, quantity="10.000").status_code, 201)
        count = StockMovement.objects.count()
        self.run_analysis()
        obj = AIAlert.objects.get()
        self.assertEqual(obj.status, "resolved")
        self.assertFalse(obj.condition_active)
        self.assertEqual(StockMovement.objects.count(), count)
        self.assertTrue(AuditLog.objects.filter(action="intelligence.alert_auto_resolved").exists())

    def test_lifecycle_actor_dates_idempotency_and_conflicts(self):
        obj = self.signal()
        path = f"/api/ai/alerts/{obj.pk}/"
        self.assertEqual(self.post(path+"acknowledge/").data["status"], "investigating")
        self.assertEqual(self.post(path+"acknowledge/").status_code, 200)
        self.assertEqual(AuditLog.objects.filter(action="intelligence.alert_acknowledged").count(), 1)
        obj.refresh_from_db()
        self.assertEqual(obj.acknowledged_by_id, self.user.pk)
        self.assertIsNotNone(obj.acknowledged_at)
        self.assertEqual(self.post(path+"resolve/").data["status"], "resolved")
        self.assertEqual(self.post(path+"resolve/").status_code, 200)
        self.assertEqual(self.post(path+"dismiss/").status_code, 409)
        self.assertEqual(self.post(path+"acknowledge/").status_code, 409)
        self.assertEqual(self.client.patch(path, dict(status="open"), format="json").status_code, 405)

    def test_dismiss_is_terminal_and_does_not_change_erp(self):
        obj = self.signal()
        self.assertEqual(self.post(f"/api/ai/alerts/{obj.pk}/dismiss/").data["status"], "dismissed")
        obj.refresh_from_db()
        self.assertEqual(obj.dismissed_by_id, self.user.pk)
        self.assertEqual(Invoice.objects.get(pk=obj.entity_id).balance_due, 1000)
        self.run_analysis()
        self.assertEqual(AIAlert.objects.count(), 1)
        self.assertEqual(self.client.get("/api/ai/risks/").data["count"], 0)

    def test_filters_pagination_and_safe_metadata(self):
        obj = self.signal()
        AIAlert.objects.filter(pk=obj.pk).update(metadata={**obj.metadata, "secret": "never-expose"})
        self.assertNotIn("never-expose", str(self.client.get(f"/api/ai/alerts/{obj.pk}/").data))
        for query in ["severity=medium", "status=open", "type=fact", "alert_type=overdue_invoice", "search=Facture", "department=Clients", "days=1&page_size=1"]:
            response = self.client.get("/api/ai/alerts/?"+query)
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data["count"], 1, query)
        for query in ["severity=invalid", "page_size=101", "days=-1", "date_from=2026-10-10&date_to=2026-10-01", "search="+"x"*151, "ordering=sql", "page=0"]:
            self.assertEqual(self.client.get("/api/ai/alerts/?"+query).status_code, 400, query)
        self.assertEqual(self.client.get("/api/ai/alerts/?severity=critical").data["count"], 0)
        self.assertEqual(self.client.get("/api/ai/anomalies/?alert_type=overdue_invoice").data["count"], 1)

    def test_cross_company_and_corrupted_related_entity_are_hidden(self):
        obj = self.signal()
        AIAlert.objects.filter(pk=obj.pk).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/ai/alerts/{obj.pk}/").status_code, 404)
        for action in ["acknowledge", "resolve", "dismiss"]:
            self.assertEqual(self.post(f"/api/ai/alerts/{obj.pk}/{action}/").status_code, 404)
        self.assertEqual(self.dashboard()["alerts"], [])
        AIAlert.objects.filter(pk=obj.pk).update(company=self.company)
        Invoice.objects.filter(pk=obj.entity_id).update(customer=self.foreign_customer)
        self.assertEqual(self.client.get(f"/api/ai/alerts/{obj.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/ai/anomalies/").data["count"], 0)
        self.assertEqual(self.client.get("/api/ai/risks/").data["count"], 0)

    def test_domain_revocation_masks_history_stats_run_and_actions(self):
        obj = self.signal()
        RolePermission.objects.filter(role=self.role, permission__code="invoices.view").delete()
        data = self.dashboard()
        self.assertEqual(data["alerts"], [])
        self.assertEqual(data["stats"]["warnings"], 0)
        self.assertNotIn("receivables", data["health"]["metrics"])
        self.assertIsNone(data["lastRun"]["summary"])
        self.assertEqual(self.post(f"/api/ai/alerts/{obj.pk}/resolve/").status_code, 404)

    def test_ai_permission_and_superuser_no_bypass(self):
        self.user.is_superuser = True
        self.user.save(update_fields=["is_superuser"])
        RolePermission.objects.filter(role=self.role, permission__code="ai.use").delete()
        self.assertEqual(self.client.get("/api/ai/control-center/").status_code, 403)
        self.assertEqual(self.post("/api/ai/control-center/refresh/").status_code, 403)
        self.client.logout()
        self.assertEqual(self.client.get("/api/ai/control-center/").status_code, 401)

    def test_ai_alone_does_not_authorize_source_data(self):
        self.signal()
        RolePermission.objects.filter(role=self.role).exclude(permission__code="ai.use").delete()
        data = self.dashboard()
        self.assertEqual(data["health"]["status"], "not_available")
        self.assertEqual(data["alerts"], [])
        self.assertEqual(self.post("/api/ai/control-center/refresh/").status_code, 403)

    def test_risks_expire_and_resolved_disappear(self):
        obj = self.signal()
        self.assertEqual(self.client.get("/api/ai/risks/").data["count"], 1)
        AIAlert.objects.filter(pk=obj.pk).update(last_seen_at=timezone.now()-timedelta(hours=25))
        self.assertEqual(self.client.get("/api/ai/risks/").data["count"], 0)
        self.run_analysis()
        self.assertEqual(self.client.get("/api/ai/risks/").data["count"], 1)
        self.post(f"/api/ai/alerts/{obj.pk}/resolve/")
        self.assertEqual(self.client.get("/api/ai/risks/").data["count"], 0)

    def test_actual_history_and_resolution_metrics(self):
        obj = self.signal()
        now = timezone.now()
        AIAlert.objects.filter(pk=obj.pk).update(detected_at=now-timedelta(minutes=20), acknowledged_at=now-timedelta(minutes=10))
        self.post(f"/api/ai/alerts/{obj.pk}/resolve/")
        data = self.dashboard()
        self.assertEqual(sum(day["medium"] for day in data["anomalyHistory"]), 1)
        self.assertEqual(sum(day["resolved"] for day in data["anomalyHistory"]), 1)
        self.assertEqual(data["resolutionRate"], 100)
        self.assertEqual(data["responseMinutes"], 10)

    def test_refresh_after_commit_eager_dedupe_and_audit(self):
        self.invoice(overdue=True)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post("/api/ai/control-center/refresh/", key="same-refresh")
            self.assertEqual(response.data["status"], "pending")
            self.assertFalse(AIAlert.objects.exists())
            repeat = self.post("/api/ai/control-center/refresh/", key="same-refresh")
            self.assertEqual(response.data["id"], repeat.data["id"])
            self.assertEqual(self.post("/api/ai/control-center/refresh/").data["id"], response.data["id"])
        run = IntelligenceRun.objects.get()
        self.assertEqual(run.status, "completed")
        self.assertEqual(run_company_intelligence.run(run.pk)["status"], "completed")
        self.assertEqual(AIAlert.objects.count(), 1)
        self.assertEqual(set(AuditLog.objects.filter(action__startswith="intelligence.").values_list("action", flat=True)), {"intelligence.refresh_requested", "intelligence.started", "intelligence.completed", "intelligence.anomalies_executed"})

    def test_rollback_and_strict_input(self):
        with self.captureOnCommitCallbacks(execute=True), patch.object(run_company_intelligence, "apply_async") as publish:
            with self.assertRaises(RuntimeError), transaction.atomic():
                self.post("/api/ai/control-center/refresh/")
                raise RuntimeError("rollback")
            publish.assert_not_called()
        self.assertFalse(IntelligenceRun.objects.exists())
        self.assertEqual(self.post("/api/ai/control-center/refresh/", dict(company_id=self.other_company.pk)).status_code, 403)
        self.assertEqual(self.post("/api/ai/control-center/refresh/", dict(prompt="SQL")).status_code, 400)
        self.assertEqual(self.client.post("/api/ai/control-center/refresh/", {}, format="json").status_code, 400)

    def test_worker_error_is_failed_without_stacktrace_or_partial_results(self):
        self.invoice(overdue=True)
        with patch("apps.intelligence.services.collect_signals", side_effect=RuntimeError("secret SQL C:/private")):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.post("/api/ai/control-center/refresh/")
        run = IntelligenceRun.objects.get()
        self.assertEqual(run.status, "failed")
        result = self.client.get(f"/api/ai/runs/{response.data['id']}/")
        self.assertEqual(result.data["errorCode"], "analysis_failed")
        self.assertNotIn("secret", str(result.data))
        self.assertFalse(AIAlert.objects.exists())

    def test_broker_unavailable_and_worker_permission_revocation(self):
        with patch.object(run_company_intelligence, "apply_async", side_effect=OperationalError("broker secret")), self.captureOnCommitCallbacks(execute=True):
            self.post("/api/ai/control-center/refresh/")
        self.assertEqual(IntelligenceRun.objects.get().error_code, "broker_unavailable")
        response = self.post("/api/ai/control-center/refresh/")
        RolePermission.objects.filter(role=self.role, permission__code="invoices.view").delete()
        self.assertEqual(run_company_intelligence.run(response.data["id"])["status"], "failed")
        self.assertEqual(IntelligenceRun.objects.get(pk=response.data["id"]).error_code, "access_revoked")

    def test_expiry_fences_late_worker_and_foreign_run(self):
        response = self.post("/api/ai/control-center/refresh/")
        run, _ = claim_run(response.data["id"])
        self.assertEqual(run.status, "running")
        IntelligenceRun.objects.filter(pk=run.pk).update(lease_expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.client.get(f"/api/ai/runs/{run.pk}/").data["status"], "failed")
        from common.exceptions import BusinessConflict
        with self.assertRaises(BusinessConflict):
            publish_signals(run, [])
        IntelligenceRun.objects.filter(pk=run.pk).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/ai/runs/{run.pk}/").status_code, 404)
        self.assertEqual(run_company_intelligence.run("bad"), dict(status="invalid"))

    def test_critical_notification_unique_no_email(self):
        self.product()
        self.run_analysis()
        self.run_analysis()
        alerts = Notification.objects.filter(type="critical_ai_alert")
        self.assertEqual(alerts.count(), 1)
        self.assertEqual(alerts.get().email_status, "skipped")
        self.assertFalse(BusinessEmail.objects.filter(notification__in=alerts).exists())
        self.assertTrue(self.client.get("/api/notifications/").data["notifications"])
        RolePermission.objects.filter(role=self.role, permission__code="products.view").delete()
        self.assertEqual(self.client.get("/api/notifications/").data["notifications"], [])

    def test_limit_failure_keeps_prior_snapshot(self):
        obj = self.signal()
        self.invoice(overdue=True)
        with patch("apps.intelligence.detection.MAX_SIGNALS", 1):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.post("/api/ai/control-center/refresh/")
        self.assertEqual(IntelligenceRun.objects.get(pk=response.data["id"]).error_code, "detection_limit")
        self.assertEqual(AIAlert.objects.get().pk, obj.pk)

    def test_overdue_date_boundary_and_severity_rules(self):
        old = self.invoice(overdue=True)
        Invoice.objects.filter(pk=old["id"]).update(issue_date=timezone.localdate()-timedelta(days=40), due_date=timezone.localdate()-timedelta(days=31))
        current = self.invoice(overdue=True)
        Invoice.objects.filter(pk=current["id"]).update(due_date=timezone.localdate())
        self.invoice(posted=False, overdue=True)
        self.run_analysis()
        self.assertEqual(AIAlert.objects.count(), 1)
        self.assertEqual(AIAlert.objects.get().severity, "high")

    def test_stock_threshold_equality_inactive_warehouse_and_notification_preference(self):
        from apps.inventory.models import CompanyInventorySetting
        product = self.product()
        self.assertEqual(self.movement(product, quantity="5.000").status_code, 201)
        self.run_analysis()
        self.assertEqual(AIAlert.objects.get().severity, "high")
        self.assertEqual(AIAlert.objects.get().metadata["value"], "5.000")
        self.warehouse.is_active = False
        self.warehouse.save(update_fields=["is_active"])
        self.run_analysis()
        self.assertFalse(AIAlert.objects.get().condition_active)
        self.warehouse.is_active = True
        self.warehouse.save(update_fields=["is_active"])
        StockLevel.objects.filter(product_id=product["id"]).update(quantity_on_hand=0, total_value=0)
        CompanyInventorySetting.objects.update_or_create(company=self.company, defaults=dict(low_stock_alerts=False))
        self.run_analysis()
        self.assertFalse(Notification.objects.filter(type="critical_ai_alert").exists())

    def test_large_list_is_paginated_and_aggregate_is_bounded(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        obj = self.signal()
        with CaptureQueriesContext(connection) as first:
            self.client.get("/api/ai/alerts/")
        AIAlert.objects.bulk_create([AIAlert(company=self.company, alert_type=obj.alert_type, entity_type=obj.entity_type, entity_id=obj.entity_id,
            title=f"Signal {i}", message="Observation", severity="medium", fingerprint=f"test:{i}", last_seen_at=timezone.now()) for i in range(55)])
        with CaptureQueriesContext(connection) as many:
            response = self.client.get("/api/ai/alerts/")
        self.assertLessEqual(len(many), len(first)+1)
        self.assertEqual(response.data["count"], 56)
        self.assertEqual(len(response.data["alerts"]), 50)
        self.assertEqual(len(self.client.get("/api/ai/alerts/?page=2").data["alerts"]), 6)
        self.assertEqual(len(self.dashboard()["alerts"]), 10)
        self.assertLessEqual(len(self.dashboard()["risks"]), 10)
        AIAlert.objects.filter(pk=obj.pk).update(severity="critical")
        ordered = self.client.get("/api/ai/alerts/?ordering=severity&page_size=1")
        self.assertEqual(ordered.data["alerts"][0]["id"], str(obj.pk))

    def test_access_is_revalidated_before_publication(self):
        self.invoice(overdue=True)
        response = self.post("/api/ai/control-center/refresh/")
        from apps.intelligence.detection import collect_signals
        def revoke(company, rules):
            values = collect_signals(company, rules)
            RolePermission.objects.filter(role=self.role, permission__code="ai.use").delete()
            return values
        with patch("apps.intelligence.services.collect_signals", side_effect=revoke):
            self.assertEqual(run_company_intelligence.run(response.data["id"])["status"], "failed")
        self.assertFalse(AIAlert.objects.exists())
