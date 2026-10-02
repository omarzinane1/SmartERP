from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError
from apps.accounts.services import require_actor
from apps.companies.models import Company
from apps.companies.sequences import next_document_number
from .models import Customer
from .selectors import company_salespeople, salesperson_name


@transaction.atomic
def save_customer(*, company, membership, data, customer_id=None):
    Company.objects.select_for_update().get(pk=company.pk)
    require_actor(company=company, actor=membership, permission_code="customers.edit" if customer_id else "customers.create")
    if customer_id is None:
        customer = Customer(company=company, currency=company.currency, country=company.country,
                            created_by_id=membership.user_id,
                            reference=next_document_number(company=company, kind="customer", prefix="CUS", dated=False))
    else:
        customer = Customer.objects.select_for_update().filter(company=company, pk=customer_id).first()
        if customer is None:
            raise NotFound()
    values = dict(data)
    if "salesperson" in values:
        name = values.pop("salesperson")
        matches = [m for m in company_salespeople(company) if salesperson_name(m) == name] if name else []
        if name and len(matches) != 1:
            raise ValidationError({"salesperson": ["Commercial inconnu ou ambigu dans cette société."]})
        customer.salesperson = matches[0] if matches else None
    if values.get("status") == "archived" and customer.status != "archived":
        customer.previous_status = customer.status
    for key, value in values.items():
        setattr(customer, key, value)
    customer.save()
    return customer
