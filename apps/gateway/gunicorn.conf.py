"""Gunicorn process policy for the self-managed production Gateway container.

Environment overrides support machine-specific tuning without changing the
image, while conservative defaults bound worker lifetime and deploy shutdown.
"""

import os

bind = "0.0.0.0:8000"
worker_class = "uvicorn_worker.UvicornWorker"
workers = int(os.getenv("GATEWAY_WORKERS", "4"))
graceful_timeout = int(os.getenv("GATEWAY_GRACEFUL_TIMEOUT", "30"))
max_requests = int(os.getenv("GATEWAY_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GATEWAY_MAX_REQUESTS_JITTER", "100"))
forwarded_allow_ips = os.getenv("FORWARDED_ALLOW_IPS", "127.0.0.1")
logconfig_json = "logging.prod.json"
