from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.services import sync_system_role_permissions
from apps.companies.models import Company


class Command(BaseCommand):
    help = "Create company-scoped system roles and add grants from the frontend matrix."

    def add_arguments(self, parser):
        parser.add_argument("--company", type=int)

    @transaction.atomic
    def handle(self, *args, **options):
        companies = Company.objects.order_by("pk")
        if options["company"]:
            companies = companies.filter(pk=options["company"])
        for company in companies:
            roles = sync_system_role_permissions(company=company)
            self.stdout.write(f"Company {company.pk}: {len(roles)} system roles synchronized; existing grants preserved.")
