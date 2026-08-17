from __future__ import annotations

import json
import os
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://openapi:openapi@localhost:5432/openapi")
os.environ.setdefault(
    "WEB_GATEWAY_HMAC_SECRET",
    "openapi-export-secret-not-for-production",
)
os.environ.setdefault("GATEWAY_PUBLIC_URL", "https://api.example.com")

from gateway.core.public_openapi import public_openapi_schema
from gateway.main import app


def main() -> None:
    repository_root = Path(__file__).resolve().parents[3]
    public_schema = public_openapi_schema(app)
    outputs = {
        repository_root / "packages/api-client/openapi.json": app.openapi(),
        repository_root / "apps/docs/openapi.public.json": public_schema,
        repository_root / "apps/docs/public/openapi.json": public_schema,
    }
    for output_path, schema in outputs.items():
        output_path.write_text(
            f"{json.dumps(schema, indent=2, sort_keys=True)}\n", encoding="utf-8"
        )


if __name__ == "__main__":
    main()
