from tempfile import TemporaryDirectory
from django.test import override_settings
from common.tests.finance_documents_support import FinanceDocumentsMixin


class AsyncDataMixin(FinanceDocumentsMixin):
    def setUp(self):
        super().setUp()
        directory = TemporaryDirectory(prefix="smarterp-async-test-")
        self.addCleanup(directory.cleanup)
        override = override_settings(MEDIA_ROOT=directory.name, CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True,
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", EMAIL_DELIVERY_ENABLED=True,
            EMAIL_DELIVERY_TEST_MODE=True, DEFAULT_FROM_EMAIL="erp@example.test")
        override.enable()
        self.addCleanup(override.disable)

    def create_job(self, format="csv", key=None, **changes):
        response = self.post("/api/reports/export/", dict(report_id="customers", format=format, **changes), key=key)
        self.assertEqual(response.status_code, 202, response.data)
        return response.data
