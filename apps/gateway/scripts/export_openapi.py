from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://openapi:openapi@localhost:5432/openapi")
os.environ.setdefault(
    "WEB_GATEWAY_HMAC_SECRET",
    "openapi-export-secret-not-for-production",
)

from gateway.main import app


def main() -> None:
    output_path = Path(__file__).resolve().parents[3] / "packages/api-client/openapi.json"
    output_path.write_text(
        f"{json.dumps(app.openapi(), indent=2, sort_keys=True)}\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
