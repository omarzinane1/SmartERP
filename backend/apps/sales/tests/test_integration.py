from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import Permission, RolePermission
from .support import SalesDataMixin


class BusinessIntegrationTests(SalesDataMixin, TestCase):
    def test_login_customer_quote_order_invoice_and_foreign_session(self):
        for code in ("customers.create", "customers.edit"):
            RolePermission.objects.create(role=self.role, permission=Permission.objects.get(code=code))
        client = APIClient(enforce_csrf_checks=True)
        token = client.get("/api/auth/csrf/").data["csrfToken"]
        login = client.post("/api/auth/login/", dict(email=self.user.email, password=self.password), format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(login.status_code, 200)
        self.assertEqual(client.get("/api/auth/session/").data["company"]["id"], self.company.pk)
        token = client.get("/api/auth/csrf/").data["csrfToken"]
        client.credentials(HTTP_X_CSRFTOKEN=token)
        created = client.post("/api/customers/", dict(name="Flow C customer", type="company", phone="", email="flow@example.test", city="Rabat", salesperson="RBAC Tester"), format="json")
        self.assertEqual(created.status_code, 201)
        cid = created.data["id"]
        quote = client.post("/api/quotes/", {**self.quote_input(), "customer_id": cid}, format="json")
        self.assertEqual(quote.status_code, 201)
        qid = quote.data["id"]
        self.assertEqual(client.post(f"/api/quotes/{qid}/send/", {}, format="json").status_code, 200)
        self.assertEqual(client.post(f"/api/quotes/{qid}/accept/", {}, format="json").status_code, 200)
        conversion = client.post(f"/api/quotes/{qid}/convert/", {"target": "sales_order"}, format="json")
        self.assertEqual(conversion.status_code, 201)
        oid = conversion.data["id"]
        self.assertEqual(client.post(f"/api/sales-orders/{oid}/confirm/", {}, format="json").status_code, 200)
        invoice = client.post(f"/api/sales-orders/{oid}/invoice/", {"amount": "64.76"}, format="json")
        self.assertEqual(invoice.status_code, 201)
        iid = invoice.data["order"]["invoices"][0]["id"]
        self.assertEqual(client.get(f"/api/invoices/{iid}/").data["customerId"], cid)
        for code in ("customers.view", "quotes.view", "sales.view"):
            RolePermission.objects.get_or_create(role=self.other_role, permission=Permission.objects.get(code=code))
        session = client.session
        session["active_company_id"] = self.other_company.pk
        session["active_membership_id"] = self.other_membership.pk
        session.save()
        for path in (f"customers/{cid}", f"quotes/{qid}", f"sales-orders/{oid}", f"invoices/{iid}"):
            self.assertEqual(client.get(f"/api/{path}/").status_code, 404)
        self.assertEqual(client.post("/api/auth/logout/", {}, format="json").status_code, 204)
        self.assertEqual(client.get("/api/auth/session/").status_code, 401)
