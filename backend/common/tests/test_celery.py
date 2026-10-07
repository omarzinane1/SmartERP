"""Broker-free tests. The separate smoke script exercises the real Valkey worker."""
import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from config import celery_app


class CeleryConfigurationTests(SimpleTestCase):
    def test_registered_task_executes_eager_without_network_or_database(self):
        celery_app.loader.import_default_modules()
        task = celery_app.tasks["common.tasks.celery_healthcheck"]
        with override_settings(CELERY_TASK_ALWAYS_EAGER=True, CELERY_TASK_EAGER_PROPAGATES=True):
            with patch("kombu.Producer.publish", side_effect=AssertionError("No broker in unit tests")):
                result = task.delay()
        self.assertTrue(result.successful())
        self.assertEqual(result.result, "ok")
        self.assertTrue(task.ignore_result)

    def settings_in_subprocess(self, module, broker="redis://broker.internal:6379/0"):
        # Start with non-secret configuration; never print or copy the real .env.
        environment = {**os.environ, "DJANGO_SETTINGS_MODULE": module, "DJANGO_SECRET_KEY": "unit-test-only-not-a-production-secret", "CELERY_BROKER_URL": broker}
        code = "import json; from config import celery_app as a; from django.conf import settings as s; print(json.dumps(dict(module=s.SETTINGS_MODULE, broker=a.conf.broker_url, eager=a.conf.task_always_eager, backend=a.conf.result_backend, accept=a.conf.accept_content, timezone=a.conf.timezone)))"
        return subprocess.run([sys.executable, "-c", code], cwd=Path(__file__).resolve().parents[2], env=environment, capture_output=True, text=True, timeout=30)

    def test_production_honors_explicit_settings_and_environment(self):
        result = self.settings_in_subprocess("config.settings.production")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertEqual(data["module"], "config.settings.production")
        self.assertEqual(data["broker"], "redis://broker.internal:6379/0")
        self.assertFalse(data["eager"])
        self.assertIsNone(data["backend"])
        self.assertEqual(data["accept"], ["json"])
        self.assertEqual(data["timezone"], "Africa/Casablanca")

    def test_production_requires_explicit_broker(self):
        result = self.settings_in_subprocess("config.settings.production", broker="")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CELERY_BROKER_URL", result.stderr)

    def test_test_settings_are_broker_free(self):
        result = self.settings_in_subprocess("config.settings.test")
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(result.stdout)
        self.assertTrue(data["eager"])
        self.assertEqual(data["broker"], "memory://")
        self.assertIsNone(data["backend"])

    def test_development_local_default_and_env_override(self):
        default = self.settings_in_subprocess("config.settings.development", broker="")
        override = self.settings_in_subprocess("config.settings.development")
        self.assertEqual(default.returncode, 0, default.stderr)
        self.assertEqual(override.returncode, 0, override.stderr)
        self.assertEqual(json.loads(default.stdout)["broker"], "redis://localhost:6379/0")
        self.assertEqual(json.loads(override.stdout)["broker"], "redis://broker.internal:6379/0")
