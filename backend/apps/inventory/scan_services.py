from apps.notifications.selectors import recipient_memberships
from apps.notifications.services import create_notification
from .models import Warehouse, CompanyInventorySetting
from .selectors import low_stock_queryset


def notify_low_stock_company(company):
    if CompanyInventorySetting.objects.filter(company=company, low_stock_alerts=False).exists():
        return 0
    permissions = ["inventory.view", "products.view"]
    recipients = list(recipient_memberships(company, permissions).values_list("user_id", flat=True))
    if not recipients:
        return 0
    created = 0
    for warehouse in Warehouse.objects.filter(company=company, is_active=True).iterator(chunk_size=100):
        for product in low_stock_queryset(company, warehouse).iterator(chunk_size=500):
            for recipient_id in recipients:
                _, new = create_notification(company=company, recipient_id=recipient_id, type="low_stock", title="Stock faible",
                    message=f"Le produit {product.reference} a atteint son seuil dans le dépôt {warehouse.code}.",
                    entity_type="product", entity_id=product.pk, warehouse=warehouse,
                    dedupe_key=f"low_stock:{product.pk}:{warehouse.pk}", permissions=permissions)
                created += new
    return created
