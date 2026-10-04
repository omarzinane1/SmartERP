from django.apps import apps
from django.db.models.signals import pre_delete
from django.db.models.deletion import ProtectedError
from apps.companies.models import Company
from .models import DocumentLink
from .registry import ENTITIES


def protect_linked_entity(sender, instance, using, **kwargs):
    # Same first lock as link creation: target deletion cannot race link insertion.
    Company.objects.using(using).select_for_update().get(pk=instance.company_id)
    kinds = [kind for kind, spec in ENTITIES.items() if apps.get_model(spec.model) is sender]
    links = DocumentLink.objects.using(using).filter(entity_type__in=kinds, entity_id=instance.pk, document__deleted_at__isnull=True)
    if links.exists():
        raise ProtectedError("Retirez les liaisons documentaires avant de supprimer cet enregistrement.", list(links))


def register_link_protection():
    for kind, spec in ENTITIES.items():
        pre_delete.connect(protect_linked_entity, sender=apps.get_model(spec.model), dispatch_uid=f"document-link-protect-{kind}")
