"""Opt-in local integration check: real broker and worker, no result backend.

Owns a temporary worker on a unique queue and stops only that worker afterward.
Requires the local Valkey service to be running; does not start/stop Docker.
"""
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
from urllib.parse import urlsplit
from uuid import uuid4

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")


def wait_for(log_path, predicate, process, timeout=45):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        log = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""
        if predicate(log):
            return
        if process.poll() is not None:
            raise RuntimeError(f"Worker exited with code {process.returncode}; startup check failed.")
        time.sleep(0.2)
    raise TimeoutError("Worker did not reach the expected state before timeout.")


def main():
    import django
    django.setup()
    from config import celery_app
    from common.tasks import celery_healthcheck
    from redis import Redis

    broker = celery_app.conf.broker_url
    address = urlsplit(broker or "")
    if address.scheme != "redis" or address.hostname not in {"localhost", "127.0.0.1", "::1"}:
        raise RuntimeError("This diagnostic is restricted to the local Redis-compatible broker.")
    if celery_app.conf.task_always_eager:
        raise RuntimeError("Use development settings: eager mode cannot validate a real broker.")
    with Redis.from_url(broker, socket_connect_timeout=5, socket_timeout=5) as client:
        if not client.ping():
            raise RuntimeError("Broker PING failed.")
    print("Valkey PING: PONG", flush=True)
    identity = uuid4().hex
    queue, hostname = f"smarterp-health-{identity}", f"smarterp-health-{identity}@localhost"
    with TemporaryDirectory(prefix="smarterp-celery-") as directory:
        log_path = Path(directory) / "worker.log"
        command = [sys.executable, "-m", "celery", "-A", "config", "worker", "--loglevel=INFO", "--pool=solo", "--concurrency=1", "--hostname", hostname, "--queues", queue, "--without-gossip", "--without-mingle", "--without-heartbeat", "--logfile", str(log_path)]
        # A diagnostic process only; production worker pool remains unrestricted.
        process = subprocess.Popen(command, cwd=BACKEND, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        try:
            wait_for(log_path, lambda log: "Connected to redis://" in log and f"{hostname} ready." in log, process)
            print("Celery worker: connected and ready (solo diagnostic)", flush=True)
            result = celery_healthcheck.apply_async(queue=queue)
            print(f"Task sent: {result.id}", flush=True)
            marker = f"Task common.tasks.celery_healthcheck[{result.id}]"
            wait_for(log_path, lambda log: marker+" received" in log and marker+" succeeded" in log and "SmartERP Celery healthcheck: ok" in log, process, timeout=30)
            print("Task received: YES\nTask succeeded: ok\nResult backend: disabled; result.get() not used", flush=True)
        finally:
            if process.poll() is None:
                try:
                    celery_app.control.broadcast("shutdown", destination=[hostname])
                except Exception:
                    # Broker may have stopped; still clean up our own process.
                    pass
                try:
                    process.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    process.terminate()
                    process.wait(timeout=10)
            print("Diagnostic worker stopped", flush=True)


if __name__ == "__main__":
    main()
