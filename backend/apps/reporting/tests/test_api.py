from io import BytesIO
from tempfile import TemporaryDirectory
from django.test import TestCase, override_settings
from openpyxl import load_workbook
from pypdf import PdfReader
from apps.accounts.models import RolePermission
from apps.crm.models import Customer
from apps.sales.models import Invoice, Quote
from common.tests.finance_documents_support import FinanceDocumentsMixin


class ReportingAPITests(FinanceDocumentsMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.storage = TemporaryDirectory()
        self.addCleanup(self.storage.cleanup)
        setting = override_settings(MEDIA_ROOT=self.storage.name)
        setting.enable()
        self.addCleanup(setting.disable)

    def content(self, response):
        data = b"".join(response.streaming_content)
        response.close()
        return data

    def test_invoice_pdf_saved_totals_headers_and_tenant(self):
        invoice = self.invoice(price="19.99", quantity="3.000", tax="20.00")
        response = self.client.get(f"/api/invoices/{invoice['id']}/pdf/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        data = self.content(response)
        self.assertTrue(data.startswith(b"%PDF-"))
        text = "\n".join(page.extract_text() for page in PdfReader(BytesIO(data)).pages)
        self.assertIn("71.96", text)
        self.assertIn("59.97", text)
        self.assertIn("Alpha", text)
        self.assertIn("Reste dû", text)
        Invoice.objects.filter(pk=invoice["id"]).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/invoices/{invoice['id']}/pdf/").status_code, 404)

    def test_quote_pdf_company_footer_no_internal_notes_and_permission(self):
        from apps.companies.models import CompanyInvoicingSetting
        CompanyInvoicingSetting.objects.update_or_create(company=self.company, defaults=dict(invoice_prefix="INV", invoice_start=1, quote_prefix="Q", quote_start=1, purchase_order_prefix="PO", payment_terms="30 jours", footer="Merci de votre confiance, société test.", language="fr"))
        data = self.quote_input()
        data["internal_notes"] = "INTERNAL-SECRET-NOT-EXPORTED"
        response = self.post("/api/quotes/", data)
        self.assertEqual(response.status_code, 201, response.data)
        pk = response.data["id"]
        pdf = self.client.get(f"/api/quotes/{pk}/pdf/")
        self.assertEqual(pdf.status_code, 200)
        text = "\n".join(page.extract_text() for page in PdfReader(BytesIO(self.content(pdf))).pages)
        self.assertIn("Merci de votre confiance", text)
        self.assertNotIn("INTERNAL-SECRET", text)
        Quote.objects.filter(pk=pk).update(company=self.other_company)
        self.assertEqual(self.client.get(f"/api/quotes/{pk}/pdf/").status_code, 404)
        RolePermission.objects.filter(role=self.role, permission__code="quotes.export").delete()
        self.assertEqual(self.client.get(f"/api/quotes/{pk}/pdf/").status_code, 403)

    def test_csv_filtered_utf8_tenant_and_formula_safety(self):
        self.customer.name = '=HYPERLINK("https://invalid.test") École'
        self.customer.save()
        response = self.client.get("/api/exports/customers/?format=csv&search=École")
        self.assertEqual(response.status_code, 200, getattr(response, "data", None))
        text = self.content(response).decode("utf-8-sig")
        self.assertIn("École", text)
        self.assertIn("'=HYPERLINK", text)
        self.assertNotIn("Foreign", text)
        self.assertNotIn("password", text)
        self.assertEqual(len(self.content(self.client.get("/api/exports/customers/?search=absent")).decode("utf-8-sig").splitlines()), 1)

    def test_xlsx_exact_decimal_date_and_filtered_ids(self):
        self.invoice(price="19.99", quantity="3.000", tax="20.00")
        response = self.client.get("/api/exports/invoices/?format=xlsx&status=posted")
        self.assertEqual(response.status_code, 200)
        book = load_workbook(BytesIO(self.content(response)), read_only=True, data_only=False)
        rows = list(book.active.values)
        self.assertEqual(rows[1][6], "11.99")
        self.assertEqual(rows[1][7], "71.96")
        self.assertRegex(rows[1][2], r"\d{4}-\d{2}-\d{2}")
        book.close()
        response = self.post("/api/exports/customers/", dict(format="csv", ids=[self.foreign_customer.pk]))
        self.assertEqual(len(self.content(response).decode("utf-8-sig").splitlines()), 1)

    def test_export_permissions_invalid_period_and_missing_entity(self):
        self.assertEqual(self.client.get("/api/exports/customers/?date_from=2026-02-01&date_to=2026-01-01").status_code, 400)
        self.assertEqual(self.client.get("/api/exports/customers/?format=pdf").status_code, 400)
        self.assertEqual(self.client.get("/api/exports/passwords/").status_code, 404)
        self.user.is_superuser = True
        self.user.save()
        RolePermission.objects.filter(role=self.role, permission__code="customers.export").delete()
        self.assertEqual(self.client.get("/api/exports/customers/").status_code, 403)

    def test_report_catalog_generate_download_snapshot_and_revoked_permission(self):
        catalog = self.client.get("/api/reports/catalog/")
        self.assertEqual(catalog.status_code, 200, catalog.data)
        self.assertIn("customers", [row["id"] for row in catalog.data["reports"]])
        result = self.post("/api/reports/generate/", dict(report_id="customers", filter="Alpha", format="xlsx"))
        self.assertEqual(result.status_code, 201, result.data)
        self.customer.name = "Changed later"
        self.customer.save()
        result = self.client.get(f"/api/reports/generated/{result.data['id']}/download/")
        self.assertEqual(result.status_code, 200)
        book = load_workbook(BytesIO(self.content(result)), read_only=True)
        self.assertEqual(list(book.active.values)[1][1], "Alpha")
        book.close()
        self.assertEqual(len(self.client.get("/api/reports/recent/").data), 1)
        RolePermission.objects.filter(role=self.role, permission__code="customers.export").delete()
        self.assertEqual(self.client.get("/api/reports/recent/").data, [])
