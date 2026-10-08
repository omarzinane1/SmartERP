from datetime import timedelta
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from celery.exceptions import Retry
from django.conf import settings
from django.db import transaction
from django.test import TestCase
from django.utils import timezone
from kombu.exceptions import OperationalError
from openpyxl import load_workbook
from pypdf import PdfReader
from apps.accounts.models import RolePermission, Membership, MembershipRole, User
from apps.audit.models import IdempotencyKey
from apps.notifications.models import Notification
from apps.reporting.models import AsyncJob
from apps.reporting.tasks import generate_report_export, generate_large_excel_export, generate_large_pdf, expire_stalled_jobs
from apps.reporting.job_services import claim_job, render_job
from apps.sales.models import Invoice
from common.tests.async_support import AsyncDataMixin


class AsyncJobTests(AsyncDataMixin, TestCase):
    def test_request_commit_csv_complete_notification_and_private_download(self):
        with patch.object(generate_report_export, "apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                response = self.create_job(filter="Alpha")
                self.assertEqual(response["status"], "pending")
                publish.assert_not_called()
            publish.assert_called_once_with(args=[response["id"]], retry=False)
        job_id = response["id"]
        def inspect_processing(job):
            self.assertEqual(AsyncJob.objects.get(pk=job_id).status, "processing")
            return render_job(job)
        with patch("apps.reporting.job_services.render_job", side_effect=inspect_processing):
            self.assertEqual(generate_report_export.run(job_id)["status"], "completed")
        job = AsyncJob.objects.get(pk=job_id)
        self.assertEqual(Notification.objects.get().entity_id, job_id)
        response = self.client.get(f"/api/jobs/{job_id}/download/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store")
        content = b"".join(response.streaming_content).decode("utf-8-sig")
        self.assertIn("Alpha", content)
        self.assertNotIn("Foreign", content)
        self.assertTrue(job.result_file.storage.exists(job.result_file.name))
        generate_report_export.run(job_id)
        self.assertEqual(Notification.objects.count(), 1)
        self.assertEqual(len([p for p in Path(settings.MEDIA_ROOT).rglob("*") if p.is_file()]), 1)

    def test_idempotent_request_payload_conflict_and_strict_input(self):
        first = self.create_job(key="same-export-key")
        self.assertEqual(self.create_job(key="same-export-key")["id"], first["id"])
        self.assertEqual(self.post("/api/reports/export/", dict(report_id="customers", format="xlsx"), key="same-export-key").status_code, 409)
        self.assertEqual(AsyncJob.objects.count(), 1)
        self.assertEqual(IdempotencyKey.objects.count(), 1)
        self.assertEqual(self.post("/api/reports/export/", dict(report_id="customers", company_id=self.other_company.pk)).status_code, 403)
        self.assertEqual(self.client.post("/api/reports/export/", dict(report_id="customers"), format="json").status_code, 400)

    def test_rollback_no_job_receipt_or_task(self):
        with patch.object(generate_report_export, "apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(RuntimeError), transaction.atomic():
                    self.create_job()
                    raise RuntimeError("rollback")
            publish.assert_not_called()
        self.assertFalse(AsyncJob.objects.exists())
        self.assertFalse(IdempotencyKey.objects.exists())

    def test_excel_uses_real_filtered_company_rows(self):
        job = self.create_job(format="xlsx", ids=[self.customer.pk, self.foreign_customer.pk])
        self.assertEqual(generate_large_excel_export.run(job["id"])["status"], "completed")
        response = self.client.get(f"/api/jobs/{job['id']}/download/")
        workbook = load_workbook(BytesIO(b"".join(response.streaming_content)), read_only=True)
        rows = list(workbook.active.values)
        workbook.close()
        self.assertEqual(len(rows), 2)
        self.assertIn("Alpha", rows[1])
        self.assertNotIn("Foreign", str(rows))

    def test_pdf_reuses_commercial_engine_and_saved_amounts(self):
        invoice = self.invoice(price="19.99", quantity="3.000", tax="20.00")
        response = self.post("/api/jobs/pdf/", dict(entity_type="invoice", entity_id=invoice["id"]))
        self.assertEqual(response.status_code, 202, response.data)
        job_id = response.data["id"]
        self.assertEqual(generate_large_pdf.run(job_id)["status"], "completed")
        data = b"".join(self.client.get(f"/api/jobs/{job_id}/download/").streaming_content)
        self.assertTrue(data.startswith(b"%PDF-"))
        text = "\n".join(page.extract_text() for page in PdfReader(BytesIO(data)).pages)
        self.assertIn("71.96", text)
        self.assertIn("Alpha", text)
        self.assertNotIn("Foreign", text)

    def test_foreign_pdf_rejected_at_api_and_worker(self):
        invoice = self.invoice()
        job = self.post("/api/jobs/pdf/", dict(entity_type="invoice", entity_id=invoice["id"])).data
        Invoice.objects.filter(pk=invoice["id"]).update(company=self.other_company, customer=self.foreign_customer)
        self.assertEqual(self.post("/api/jobs/pdf/", dict(entity_type="invoice", entity_id=invoice["id"])).status_code, 404)
        self.assertEqual(generate_large_pdf.run(job["id"])["status"], "failed")
        self.assertFalse(AsyncJob.objects.get(pk=job["id"]).result_file)

    def test_owner_company_and_current_permissions_on_read_download_retry(self):
        job = self.create_job()
        generate_report_export.run(job["id"])
        user = User.objects.create_user(email="second@example.test")
        member = Membership.objects.create(user=user, company=self.company, is_default=True)
        MembershipRole.objects.create(membership=member, role=self.role)
        self.client.force_login(user)
        for suffix in ["", "download/"]:
            self.assertEqual(self.client.get(f"/api/jobs/{job['id']}/{suffix}").status_code, 404)
        self.assertEqual(self.post(f"/api/jobs/{job['id']}/retry/").status_code, 404)
        self.assertEqual(self.client.get("/api/jobs/").data["count"], 0)
        self.client.force_login(self.user)
        AsyncJob.objects.filter(pk=job["id"]).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/jobs/{job['id']}/").status_code, 404)
        AsyncJob.objects.filter(pk=job["id"]).update(company=self.company)
        RolePermission.objects.filter(role=self.role, permission__code="customers.export").delete()
        self.assertEqual(self.client.get(f"/api/jobs/{job['id']}/download/").status_code, 404)

    def test_worker_revalidates_permissions_and_active_company(self):
        job = self.create_job()
        RolePermission.objects.filter(role=self.role, permission__code="customers.export").delete()
        self.assertEqual(generate_report_export.run(job["id"])["status"], "failed")
        obj = AsyncJob.objects.get(pk=job["id"])
        self.assertEqual(obj.error_code, "access_revoked")
        self.assertFalse(obj.result_file)
        self.assertEqual(generate_report_export.run(999999)["status"], "invalid")
        self.assertEqual(generate_report_export.run(None)["status"], "invalid")

    def test_failure_controlled_error_retry_and_broker_outage(self):
        job = self.create_job()
        with patch("apps.reporting.job_services.render_job", side_effect=ValueError("password=private")):
            self.assertEqual(generate_report_export.run(job["id"])["status"], "failed")
        obj = AsyncJob.objects.get(pk=job["id"])
        self.assertNotIn("private", obj.error_message)
        with patch.object(generate_report_export, "apply_async", side_effect=OperationalError("offline")):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.post(f"/api/jobs/{obj.pk}/retry/")
                self.assertEqual(response.status_code, 202, response.data)
        obj.refresh_from_db()
        self.assertEqual((obj.status, obj.error_code), ("failed", "broker_unavailable"))
        with patch.object(generate_report_export, "apply_async"):
            with self.captureOnCommitCallbacks(execute=True):
                self.assertEqual(self.post(f"/api/jobs/{obj.pk}/retry/").status_code, 202)
        self.assertEqual(generate_report_export.run(obj.pk)["status"], "completed")
        self.assertEqual(self.post(f"/api/jobs/{obj.pk}/retry/").status_code, 409)

    def test_transient_storage_retry_is_bounded_and_leaves_one_file(self):
        job = self.create_job()
        with patch("apps.reporting.job_services.render_job", side_effect=TimeoutError()), patch.object(generate_report_export, "retry", side_effect=Retry()) as retry:
            with self.assertRaises(Retry):
                generate_report_export.run(job["id"])
            retry.assert_called_once_with(countdown=30)
        self.assertEqual(AsyncJob.objects.get(pk=job["id"]).status, "pending")
        generate_report_export.run(job["id"])
        self.assertEqual(AsyncJob.objects.get(pk=job["id"]).attempts, 2)
        self.assertEqual(len([p for p in Path(settings.MEDIA_ROOT).rglob("*") if p.is_file()]), 1)

    def test_stale_processing_recovery_and_late_worker_cannot_publish(self):
        job = self.create_job()
        def expire_during_render(obj):
            stream = render_job(obj)
            AsyncJob.objects.filter(pk=obj.pk).update(lease_expires_at=timezone.now()-timedelta(seconds=1))
            self.assertEqual(expire_stalled_jobs.run()["jobs"], 1)
            return stream
        with patch("apps.reporting.job_services.render_job", side_effect=expire_during_render):
            generate_report_export.run(job["id"])
        obj = AsyncJob.objects.get(pk=job["id"])
        self.assertEqual((obj.status, obj.error_code), ("failed", "execution_expired"))
        self.assertFalse(obj.result_file)
        self.assertFalse(Notification.objects.exists())
        self.assertFalse([p for p in Path(settings.MEDIA_ROOT).rglob("*") if p.is_file()])

    def test_poll_recovers_stale_pending_and_retry_resets_queue_deadline(self):
        job = self.create_job()
        AsyncJob.objects.filter(pk=job["id"]).update(created_at=timezone.now()-timedelta(days=2), lease_expires_at=timezone.now()-timedelta(seconds=1))
        self.assertEqual(self.client.get(f"/api/jobs/{job['id']}/").data["status"], "failed")
        self.assertEqual(self.post(f"/api/jobs/{job['id']}/retry/").status_code, 202)
        self.assertEqual(self.client.get(f"/api/jobs/{job['id']}/").data["status"], "pending")
        self.assertEqual(self.client.get(f"/api/jobs/{job['id']}/download/").status_code, 409)

    def test_duplicate_claim_and_wrong_task_type_do_not_render(self):
        job = self.create_job()
        self.assertEqual(generate_large_pdf.run(job["id"])["error"], "job_type_mismatch")
        claim, _ = claim_job(job["id"], "report_export")
        self.assertIsNotNone(claim)
        with patch("apps.reporting.job_services.render_job") as render:
            self.assertEqual(generate_report_export.run(job["id"])["status"], "processing")
            render.assert_not_called()
