from datetime import timedelta
from django.utils import timezone
from apps.accounts.models import Permission, RolePermission
from apps.accounts.tests.support import RBACDataMixin
from apps.crm.models import Customer


class SalesDataMixin(RBACDataMixin):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.customer = Customer.objects.create(company=cls.company, reference="CUS-000001", name="Alpha", email="alpha@example.test", city="Rabat", type="company", salesperson=cls.membership)
        cls.foreign_customer = Customer.objects.create(company=cls.other_company, reference="CUS-000001", name="Foreign", email="foreign@example.test", city="Fes", type="company")
        for code in ("quotes.view", "quotes.create", "quotes.edit", "quotes.send", "quotes.accept", "quotes.convert", "sales.view", "sales.edit", "invoices.view", "invoices.create", "invoices.edit"):
            RolePermission.objects.get_or_create(role=cls.role, permission=Permission.objects.get(code=code))

    def quote_input(self, **overrides):
        today = timezone.localdate()
        return dict(customer_id=self.customer.pk, billing_address="Rabat", salesperson="RBAC Tester", issue_date=today.isoformat(),
                    expires_at=(today + timedelta(days=30)).isoformat(), currency="MAD", payment_terms="30 jours", customer_reference="REF", subject="Services",
                    delivery_terms="", commercial_terms="", internal_notes="", customer_notes="",
                    lines=[dict(product_id=None, description="Prestation", quantity="3.000", unit_price="19.99", discount_rate="10.00", tax_rate="20.00")], **overrides)
