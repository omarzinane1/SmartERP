from datetime import date, datetime, timedelta, timezone as datetime_timezone
from decimal import Decimal
from unittest.mock import patch
from django.db import connection, IntegrityError, transaction
from django.test import TestCase, SimpleTestCase
from django.test.utils import CaptureQueriesContext
from apps.accounts.models import Permission, RolePermission
from apps.audit.models import AuditLog
from apps.finance.models import Expense, Payment
from apps.finance.summary_selectors import get_expenses_summary, get_revenue_summary
from apps.intelligence.anomalies import expense_spike
from apps.intelligence.constants import ANALYTICS_VERSION
from apps.intelligence.features import build_series
from apps.intelligence.forecasting import evaluate_series
from apps.intelligence.health import business_health
from apps.intelligence.models import AIAlert, ForecastRun, IntelligenceRun
from apps.intelligence.services import execute_run
from apps.sales.models import Invoice
from common.dates import company_today
from common.tests.async_support import AsyncDataMixin


class ForecastAlgorithmsTests(SimpleTestCase):
    def series(self, count=70, value=lambda i: Decimal(100)+i*2):
        return [dict(date=date(2026, 1, 1)+timedelta(days=i), value=value(i), activity=True) for i in range(count)]

    def test_trend_evaluated_on_holdout_and_refitted_for_seven_points(self):
        result = evaluate_series(self.series(), "revenue")
        self.assertEqual(result["model"], "linear_trend")
        self.assertEqual(result["metrics"], dict(mae="0.00", rmse="0.00"))
        self.assertEqual(len(result["forecast"]), 7)
        self.assertEqual(result["forecast"][0]["value"], "240.00")
        self.assertEqual(result["parameters"]["slope"], "2")
        self.assertLess(result["validation"]["trainingEnd"], result["validation"]["start"])
        self.assertEqual(result["trainingEnd"], result["validation"]["end"])
        self.assertEqual(len(result["candidates"]), 3)
        self.assertEqual(result, evaluate_series(self.series(), "revenue"))
        for point in result["forecast"]:
            self.assertTrue(Decimal(point["value"]).is_finite())
            self.assertIsNone(point["lowerBound"])
            self.assertIsNone(point["upperBound"])

    def test_constant_and_zero_choose_simple_baseline_and_never_divide_by_zero(self):
        for value in [Decimal(0), Decimal(100), Decimal(-100)]:
            result = evaluate_series(self.series(value=lambda i: value), "net_cash_flow")
            self.assertEqual(result["model"], "naive")
            self.assertEqual(Decimal(result["total"]), value*7)
            self.assertEqual(result["risk"], value < 0)

    def test_thirty_day_forecast_requires_120_days(self):
        self.assertEqual(evaluate_series(self.series(119), "revenue", 30)["status"], "INSUFFICIENT_DATA")
        result = evaluate_series(self.series(120), "revenue", 30)
        self.assertEqual(len(result["forecast"]), 30)
        self.assertEqual(result["validation"]["days"], 30)

    def test_empty_short_sparse_and_stale_series_do_not_fabricate_predictions(self):
        sparse = self.series()
        for point in sparse[10:]:
            point["activity"] = False
        stale = self.series()
        for point in stale[-15:]:
            point["activity"] = False
        for series in [[], self.series(55), sparse, stale]:
            result = evaluate_series(series, "revenue")
            self.assertEqual(result["status"], "INSUFFICIENT_DATA")
            self.assertIsNone(result["metrics"])
            self.assertEqual(result["forecast"], [])

    def test_invalid_horizons_granularity_metric_and_nonfinite_data_rejected(self):
        for kwargs in [dict(horizon=365), dict(horizon=True), dict(granularity="month"), dict(metric="demand")]:
            with self.assertRaises(ValueError):
                evaluate_series(self.series(), **{**dict(metric="revenue"), **kwargs})
        with self.assertRaises(ValueError):
            evaluate_series(self.series(value=lambda i: Decimal("NaN")), "revenue")

    def test_validation_tail_is_not_used_to_fit_candidates(self):
        series = self.series(value=lambda i: Decimal(100) if i < 63 else Decimal(1000))
        result = evaluate_series(series, "revenue")
        self.assertEqual(result["metrics"]["mae"], "900.00")
        self.assertEqual(result["model"], "naive")
        self.assertEqual(result["forecast"][0]["value"], "1000.00")

    def test_history_limit_and_missing_calendar_dates_rejected(self):
        with self.assertRaises(ValueError):
            evaluate_series(self.series(181), "revenue")
        series = self.series()
        series.pop(5)
        with self.assertRaises(ValueError):
            evaluate_series(series, "revenue")


class IntelligenceAnalyticsTests(AsyncDataMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        for code in ["ai.use", "expenses.view", "forecast.view", "forecast.recalculate", "supplier_invoices.view"]:
            RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code=code))

    def setUp(self):
        super().setUp()
        self.day = company_today(self.company)-timedelta(days=1)

    def expense_row(self, day, amount="5000", company=None, **changes):
        number = f"EXP-{Expense.objects.count()}"
        return Expense.objects.create(**{**dict(company=company or self.company, number=number, operation_key=number,
            date=day, description="Controlled expense", category="Fournitures", employee="Test", amount_ht=amount,
            tax_amount=0, tax_rate=0, total=amount, currency="MAD", status="approved", created_by=self.user), **changes})

    def expense_history(self, spike="30000"):
        for i in range(1, 36):
            self.expense_row(self.day-timedelta(days=i))
        return self.expense_row(self.day, spike)

    def revenue_history(self, company=None, customer=None, member=None, days=70):
        rows = []
        for i in range(days):
            day = self.day-timedelta(days=days-i-1)
            amount = Decimal(100)+2*i
            rows.append(Invoice(company=company or self.company, customer=customer or self.customer,
                salesperson=member or self.membership, number=f"H-{i}", issue_date=day, due_date=day+timedelta(days=120),
                currency="MAD", status="posted", subtotal=amount, gross_total=amount, total=amount, balance_due=amount))
        Invoice.objects.bulk_create(rows)

    def run_analysis(self, **params):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.post("/api/ai/control-center/refresh/", params)
        self.assertEqual(response.status_code, 202, response.data)
        run = IntelligenceRun.objects.get(pk=response.data["id"])
        self.assertEqual(run.status, "completed", run.error_code)
        return run

    def dashboard(self):
        response = self.client.get("/api/ai/control-center/")
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def test_daily_feature_gaps_not_padded_before_first_event_and_partial_day_excluded(self):
        self.expense_row(self.day-timedelta(days=3), "100")
        self.expense_row(self.day, "200")
        self.expense_row(self.day+timedelta(days=1), "999999")
        rows = build_series(self.company, "expenses", self.day)
        self.assertEqual([r["value"] for r in rows], [100, 0, 0, 200])
        self.assertEqual([r["activity"] for r in rows], [True, False, False, True])
        with self.assertRaises(ValueError):
            build_series(self.company, "expenses", self.day, 181)

    def test_health_sources_high_expenses_explanations_and_no_score(self):
        self.invoice(price="100", quantity="1")
        self.expense_row(self.day, "200")
        data = self.dashboard()["health"]
        self.assertEqual(data["metrics"]["sales"]["revenue"], Decimal(100))
        self.assertEqual(data["metrics"]["expenses"]["subtotal"], Decimal(200))
        self.assertEqual(data["status"], "warning")
        self.assertIsNone(data["score"])
        self.assertTrue(any("dépenses HT" in issue["reason"] for issue in data["issues"]))
        self.assertEqual(get_expenses_summary(self.company, self.day, self.day)["subtotal"], 200)
        self.assertEqual(get_revenue_summary(self.company, self.day-timedelta(days=29), self.day+timedelta(days=1)), 100)

    def test_health_growth_threshold_and_zero_reference(self):
        old = self.invoice(price="100", quantity="1")
        Invoice.objects.filter(pk=old["id"]).update(issue_date=self.day-timedelta(days=40), due_date=self.day+timedelta(days=20))
        new = self.invoice(price="80", quantity="1")
        data = self.dashboard()["health"]
        self.assertEqual(data["metrics"]["sales"]["growthPercent"], -20)
        self.assertEqual(data["status"], "warning")
        Invoice.objects.filter(pk=new["id"]).update(subtotal=81, gross_total=81, total=81, balance_due=81)
        self.assertEqual(self.dashboard()["health"]["status"], "healthy")
        Invoice.objects.filter(pk=old["id"]).update(status="draft")
        self.assertIsNone(self.dashboard()["health"]["metrics"]["sales"]["growthPercent"])

    def test_expenses_exclude_foreign_currency_corrupt_partner_and_unapproved_rows(self):
        self.expense_row(self.day, "100")
        self.expense_row(self.day, "700", company=self.other_company)
        self.expense_row(self.day, "800", currency="EUR")
        self.expense_row(self.day, "900", status="draft")
        from apps.purchasing.models import Supplier
        supplier = Supplier.objects.create(company=self.other_company, name="Foreign", reference="F", buyer=self.other_membership)
        self.expense_row(self.day, "1000", supplier=supplier)
        self.assertEqual(build_series(self.company, "expenses", self.day)[0]["value"], 100)
        self.assertEqual(get_expenses_summary(self.company, self.day, self.day)["total"], 100)

    def test_normal_dataset_no_anomaly_and_small_history_is_explicit(self):
        self.expense_row(self.day, "30000")
        detected, status = expense_spike(self.company, self.day)
        self.assertEqual(detected, [])
        self.assertEqual(status["status"], "INSUFFICIENT_DATA")
        for i in range(1, 36):
            self.expense_row(self.day-timedelta(days=i), "30000")
        detected, status = expense_spike(self.company, self.day)
        self.assertEqual(detected, [])
        self.assertEqual(status["status"], "completed")

    def test_spike_exact_baseline_severity_deduplication_and_lifecycle(self):
        self.expense_history()
        run = self.run_analysis()
        alert = AIAlert.objects.get(alert_type="expense_spike")
        self.assertEqual((alert.observed_value, alert.expected_value, alert.deviation), (30000, 5000, 25000))
        self.assertEqual(alert.severity, "critical")
        self.assertEqual(alert.method, "activity_day_iqr")
        self.assertEqual(alert.analysis_version, ANALYTICS_VERSION)
        self.assertIn("35 journées actives", alert.message)
        self.assertEqual(run.summary["anomalies"]["status"], "completed")
        self.assertEqual(self.post(f"/api/ai/alerts/{alert.pk}/dismiss/").status_code, 200)
        self.run_analysis()
        self.assertEqual(AIAlert.objects.filter(alert_type="expense_spike").count(), 1)
        alert.refresh_from_db()
        self.assertEqual(alert.status, "dismissed")
        from apps.notifications.models import Notification
        self.assertEqual(Notification.objects.filter(type="critical_ai_alert").count(), 1)
        self.assertTrue(AuditLog.objects.filter(action="intelligence.anomalies_executed").exists())
        self.assertFalse(any("history" in str(row.metadata) for row in AuditLog.objects.all()))

    def test_anomaly_threshold_boundaries_and_correction_does_not_create_second_episode(self):
        current = self.expense_history("10000")
        self.assertEqual(expense_spike(self.company, self.day)[0], [])
        Expense.objects.filter(pk=current.pk).update(amount_ht="10000.01", total="10000.01")
        self.run_analysis()
        alert = AIAlert.objects.get(alert_type="expense_spike")
        self.assertEqual(alert.severity, "high")
        Expense.objects.filter(pk=current.pk).update(amount_ht="5000", total="5000")
        self.run_analysis()
        alert.refresh_from_db()
        self.assertEqual(alert.status, "resolved")
        Expense.objects.filter(pk=current.pk).update(amount_ht="30000", total="30000")
        self.run_analysis()
        self.assertEqual(AIAlert.objects.filter(alert_type="expense_spike").count(), 1)

    def test_anomaly_api_filters_pagination_permission_and_company_isolation(self):
        self.expense_history()
        self.run_analysis()
        alert = AIAlert.objects.get(alert_type="expense_spike")
        path = "/api/ai/anomalies/?domain=finance&type=analysis&source=statistical&severity=critical&status=open&page_size=1"
        result = self.client.get(path)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data["count"], 1)
        self.assertEqual(result.data["anomalies"][0]["expectedValue"], "5000.000000")
        RolePermission.objects.filter(role=self.role, permission__code="expenses.view").delete()
        self.assertEqual(self.client.get(path).data["count"], 0)
        self.assertEqual(self.client.get(f"/api/ai/alerts/{alert.pk}/").status_code, 404)
        self.assertIsNone(self.dashboard()["lastRun"]["summary"])

    def test_forecast_persistence_api_history_no_cross_company_or_corrupt_parent(self):
        self.revenue_history()
        self.revenue_history(company=self.other_company, customer=self.foreign_customer, member=self.other_membership)
        self.run_analysis()
        forecast = ForecastRun.objects.get(metric="revenue")
        self.assertEqual(forecast.model_name, "linear_trend")
        self.assertEqual(forecast.result["forecast"][0]["value"], "240.00")
        detail = self.client.get(f"/api/ai/forecasts/{forecast.pk}/")
        self.assertEqual(detail.status_code, 200)
        self.assertIsNone(detail.data["confidence"])
        self.assertEqual(self.client.get("/api/ai/forecasts/?metric=revenue&page_size=1").data["count"], 1)
        self.assertEqual(self.dashboard()["stats"]["forecasts"], 1)
        ForecastRun.objects.filter(pk=forecast.pk).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/ai/forecasts/{forecast.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/ai/forecasts/?metric=revenue").data["count"], 0)

    def test_no_forecast_on_insufficient_data_and_latest_insufficient_replaces_old_result(self):
        self.revenue_history()
        self.run_analysis()
        Invoice.objects.filter(company=self.company).update(status="draft")
        self.run_analysis()
        result = next(f for f in self.dashboard()["forecasts"] if f["result"]["metric"] == "revenue")
        self.assertEqual(result["result"]["status"], "INSUFFICIENT_DATA")
        self.assertEqual(result["result"]["forecast"], [])
        self.assertEqual(self.dashboard()["stats"]["forecasts"], 0)

    def test_forecast_permissions_read_recalculate_and_post_enqueue_revocation(self):
        RolePermission.objects.filter(role=self.role, permission__code="forecast.recalculate").delete()
        self.run_analysis()
        self.assertFalse(ForecastRun.objects.exists())
        RolePermission.objects.get_or_create(role=self.role, permission=Permission.objects.get(code="forecast.recalculate"))
        response = self.post("/api/ai/control-center/refresh/")
        RolePermission.objects.filter(role=self.role, permission__code="forecast.view").delete()
        self.assertEqual(execute_run(response.data["id"])["status"], "failed")
        self.assertEqual(self.client.get("/api/ai/forecasts/").status_code, 403)
        self.assertFalse(ForecastRun.objects.exists())

    def test_revocation_after_calculation_prevents_publication(self):
        from apps.intelligence.forecasting import generate_forecast
        def revoked(*args, **kwargs):
            result = generate_forecast(*args, **kwargs)
            RolePermission.objects.filter(role=self.role, permission__code="forecast.view").delete()
            return result
        with patch("apps.intelligence.services.generate_forecast", side_effect=revoked), self.captureOnCommitCallbacks(execute=True):
            self.post("/api/ai/control-center/refresh/")
        self.assertEqual(IntelligenceRun.objects.get().error_code, "access_revoked")
        self.assertFalse(ForecastRun.objects.exists())
        self.assertFalse(AIAlert.objects.exists())

    def test_forecast_failure_is_audited_and_rolls_back_all_publication(self):
        self.expense_history()
        with patch("apps.intelligence.services.generate_forecast", side_effect=RuntimeError("secret internal")), self.captureOnCommitCallbacks(execute=True):
            self.post("/api/ai/control-center/refresh/")
        run = IntelligenceRun.objects.get()
        self.assertEqual(run.error_code, "forecast_failed")
        self.assertFalse(AIAlert.objects.exists())
        self.assertFalse(ForecastRun.objects.exists())
        self.assertNotIn("secret", str(self.dashboard()))
        self.assertEqual(AuditLog.objects.get(action="intelligence.failed").metadata["version"], ANALYTICS_VERSION)

    def test_horizon_validation_idempotency_and_database_constraints(self):
        for params in [dict(horizon=365), dict(granularity="month"), dict(history_days=10000)]:
            self.assertEqual(self.post("/api/ai/control-center/refresh/", params).status_code, 400)
        first = self.post("/api/ai/control-center/refresh/", dict(horizon=30), key="horizon-test")
        self.assertEqual(first.status_code, 202)
        self.assertEqual(self.post("/api/ai/control-center/refresh/", dict(horizon=7), key="horizon-test").status_code, 409)
        execute_run(first.data["id"])
        forecast = ForecastRun.objects.first()
        self.assertEqual(forecast.horizon, 30)
        with self.assertRaises(IntegrityError), transaction.atomic():
            ForecastRun.objects.filter(pk=forecast.pk).update(horizon=365)

    def test_sql_aggregation_is_bounded_and_tenant_health_excludes_foreign(self):
        self.expense_history()
        with CaptureQueriesContext(connection) as small:
            rows = build_series(self.company, "expenses", self.day)
        for i in range(200):
            self.expense_row(self.day, "10", company=self.other_company)
        with CaptureQueriesContext(connection) as many:
            actual = build_series(self.company, "expenses", self.day)
        self.assertEqual(rows, actual)
        self.assertEqual(len(small), len(many))
        self.assertLessEqual(len(many), 2)
        self.assertEqual(business_health(self.other_company, {"ai.use", "expenses.view"})["metrics"]["expenses"]["total"], 2000)

    def test_cash_forecast_uses_daily_net_not_cumulative_balance(self):
        from apps.purchasing.models import Supplier
        supplier = Supplier.objects.create(company=self.company, buyer=self.membership, name="Local", reference="LOCAL")
        for i in range(70):
            Payment.objects.create(company=self.company, supplier=supplier, direction="outgoing", amount=100, currency="MAD",
                date=self.day-timedelta(days=i), method="cash", created_by=self.user, number=f"P-{i}", operation_key=f"P-{i}")
        self.run_analysis()
        result = ForecastRun.objects.get(metric="net_cash_flow")
        self.assertEqual(result.result["total"], "-700.00")
        self.assertTrue(result.result["risk"])
        self.assertEqual(result.model_name, "naive")
        self.assertIn("solde bancaire", next(f for f in self.dashboard()["forecasts"] if f["result"]["metric"] == "net_cash_flow")["detail"])

    def test_revenue_daily_credits_are_signed_and_use_their_own_business_date(self):
        from apps.sales.models import CreditNote
        self.revenue_history()
        invoice = Invoice.objects.filter(company=self.company).first()
        CreditNote.objects.create(company=self.company, customer=self.customer, original_invoice=invoice, number="CR-1",
            date=self.day, currency="MAD", created_by=self.user, operation_key="credit-one", gross_total=300, discount_total=0,
            subtotal=300, tax_total=0, total=300, reason="Controlled return")
        rows = build_series(self.company, "revenue", self.day)
        self.assertEqual(rows[-1]["value"], Decimal(-62))
        self.assertEqual(get_revenue_summary(self.company, self.day, self.day), Decimal(-62))
        Invoice.objects.filter(pk=invoice.pk).update(customer=self.foreign_customer)
        self.assertEqual(build_series(self.company, "revenue", self.day)[-1]["value"], 0)

    def test_forecast_read_revocation_hides_existing_result_history_stats_and_run_summary(self):
        self.revenue_history()
        self.run_analysis()
        forecast = ForecastRun.objects.get(metric="revenue")
        RolePermission.objects.filter(role=self.role, permission__code="invoices.view").delete()
        self.assertEqual(self.client.get(f"/api/ai/forecasts/{forecast.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/ai/forecasts/?metric=revenue").data["count"], 0)
        data = self.dashboard()
        self.assertEqual(data["stats"]["forecasts"], 0)
        self.assertNotIn("sales", data["health"]["metrics"])
        self.assertIsNone(data["lastRun"]["summary"])

    def test_forecasts_expire_and_keep_original_currency_after_company_settings_change(self):
        from django.utils import timezone
        self.revenue_history()
        self.run_analysis()
        forecast = ForecastRun.objects.get(metric="revenue")
        ForecastRun.objects.filter(pk=forecast.pk).update(created_at=timezone.now()-timedelta(hours=25))
        result = self.client.get(f"/api/ai/forecasts/{forecast.pk}/").data
        self.assertTrue(result["stale"])
        self.assertEqual(self.dashboard()["stats"]["forecasts"], 0)
        ForecastRun.objects.filter(pk=forecast.pk).update(created_at=timezone.now())
        self.company.currency = "EUR"
        self.company.save(update_fields=["currency"])
        result = self.client.get(f"/api/ai/forecasts/{forecast.pk}/").data
        self.assertTrue(result["stale"])
        self.assertEqual(result["result"]["currency"], "MAD")
        self.assertIn("MAD", result["detail"])

    def test_company_timezone_controls_last_closed_day(self):
        self.company.timezone = "America/New_York"
        self.company.save(update_fields=["timezone"])
        moment = datetime(2026, 10, 12, 1, tzinfo=datetime_timezone.utc)
        with patch("django.utils.timezone.now", return_value=moment):
            run = self.run_analysis()
        self.assertEqual(run.summary["anomalies"]["period"], "2026-10-10")
        self.assertEqual(ForecastRun.objects.get(metric="revenue").result["asOfDay"], "2026-10-10")

    def test_midnight_between_calculation_and_publication_preserves_period_deduplication(self):
        from apps.intelligence.services import publish_signals
        self.expense_history()
        self.run_analysis()
        def midnight(*args, **kwargs):
            with patch("apps.intelligence.services.company_today", return_value=self.day+timedelta(days=2)):
                return publish_signals(*args, **kwargs)
        with patch("apps.intelligence.services.publish_signals", side_effect=midnight):
            self.run_analysis()
        self.assertEqual(AIAlert.objects.filter(alert_type="expense_spike").count(), 1)
