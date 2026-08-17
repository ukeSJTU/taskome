from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import FastAPI

_HTTP_METHODS = {"delete", "get", "head", "options", "patch", "post", "put", "trace"}


def public_openapi_schema(application: FastAPI) -> dict[str, Any]:
    cached = application.state.public_openapi_schema
    if cached is not None:
        return cached

    full_schema = application.openapi()
    paths: dict[str, Any] = {}
    for path, path_item in full_schema.get("paths", {}).items():
        if not path.startswith("/v1/"):
            continue
        projected_item = deepcopy(path_item)
        for method, operation in projected_item.items():
            if method in _HTTP_METHODS:
                operation["security"] = [{"BearerAuth": []}, {"APIKeyHeader": []}]
        paths[path.removeprefix("/v1")] = projected_item

    schema = deepcopy(full_schema)
    schema["paths"] = paths
    schema["servers"] = [
        {"url": f"{str(application.state.settings.gateway_public_url).rstrip('/')}/v1"}
    ]
    schema.setdefault("components", {})["securitySchemes"] = {
        "BearerAuth": {"scheme": "bearer", "type": "http"},
        "APIKeyHeader": {"in": "header", "name": "X-API-Key", "type": "apiKey"},
    }
    application.state.public_openapi_schema = schema
    return schema
