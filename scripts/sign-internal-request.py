#!/usr/bin/env python3
# ruff: noqa: T201, PLR0913
"""Build (and optionally send) an HMAC-signed internal Task Server request.

Task Servers built on `packages/task-kit` only accept internal REST/MCP calls
signed with the `taskome-v1` scheme (see `docs/adr/0007-internal-service-hmac-signing.md`).
Gateway is the only production caller and does this automatically -- this
script exists purely so a human can hand-verify a Task Server running locally
(e.g. via `docker compose up task-fpocket`) without standing up a real Gateway.

Stdlib only, deliberately: this is a standalone debugging tool, not part of
any app's dependency tree, so it must run with a bare `python3` and nothing
else installed.

Examples:

    # Fetch the manifest of the Task Server started by `docker compose up task-fpocket`
    ./scripts/sign-internal-request.py \\
        --secret taskome-local-fpocket-gateway-hmac-secret \\
        --method GET --target /internal/manifest --execute

    # Run detect_pockets (needs a real Gateway-resolvable Input File id; this
    # will fail with a 502 input_materialization_failed against a Task Server
    # that has no live Gateway to resolve it from -- expected without one)
    ./scripts/sign-internal-request.py \\
        --secret taskome-local-fpocket-gateway-hmac-secret \\
        --method POST --target /internal/tasks/detect_pockets \\
        --job-id 00000000-0000-0000-0000-000000000001 \\
        --body '{"structure": "00000000-0000-0000-0000-000000000099"}' \\
        --execute

    # Print headers only, to paste into your own curl command
    ./scripts/sign-internal-request.py \\
        --secret taskome-local-fpocket-gateway-hmac-secret \\
        --method GET --target /internal/manifest
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request

_SCHEME = "taskome-v1"


def _canonical_signature(
    *, secret: str, timestamp: str, method: str, target: str, job_id: str, body: bytes
) -> str:
    """Reproduce task-kit's production HMAC scheme (ADR-0007)."""
    canonical = "\n".join(
        (_SCHEME, timestamp, method.upper(), target, job_id, "", hashlib.sha256(body).hexdigest())
    )
    return hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()


def build_headers(
    *, secret: str, method: str, target: str, body: bytes, job_id: str | None
) -> dict[str, str]:
    timestamp = str(int(time.time()))
    headers = {
        "X-Taskome-Timestamp": timestamp,
        "X-Taskome-Signature": _canonical_signature(
            secret=secret,
            timestamp=timestamp,
            method=method,
            target=target,
            job_id=job_id or "",
            body=body,
        ),
    }
    if job_id is not None:
        headers["X-Taskome-Job-Id"] = job_id
    return headers


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--secret", required=True, help="the Task Server's GATEWAY_TASK_HMAC_SECRET"
    )
    parser.add_argument("--method", required=True, choices=["GET", "POST"])
    parser.add_argument(
        "--target", required=True, help="e.g. /internal/manifest or /internal/tasks/detect_pockets"
    )
    parser.add_argument("--body", default="", help="raw JSON request body (POST only)")
    parser.add_argument("--job-id", default=None, help="required for /internal/tasks/{task_name}")
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:18000",
        help="default matches compose.yml's dev-only published port",
    )
    parser.add_argument(
        "--execute", action="store_true", help="send the request instead of just printing headers"
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    body = args.body.encode()
    headers = build_headers(
        secret=args.secret, method=args.method, target=args.target, body=body, job_id=args.job_id
    )

    if not args.execute:
        for name, value in headers.items():
            print(f"{name}: {value}")
        return

    if body:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(  # noqa: S310
        f"{args.base_url}{args.target}", data=body or None, headers=headers, method=args.method
    )
    try:
        with urllib.request.urlopen(request) as response:  # noqa: S310
            print(f"HTTP {response.status}")
            print(json.dumps(json.loads(response.read()), indent=2))
    except urllib.error.HTTPError as error:
        print(f"HTTP {error.code}")
        print(error.read().decode())


if __name__ == "__main__":
    main()
