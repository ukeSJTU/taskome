from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from fastapi import FastAPI

_HTTP_METHODS = {"delete", "get", "head", "options", "patch", "post", "put", "trace"}


def _referenced_components(
    paths: dict[str, Any], full_components: dict[str, Any]
) -> dict[str, Any]:
    """Return only components reachable from the projected operations."""
    components: dict[str, Any] = {}
    pending = list(_component_references(paths))
    visited: set[tuple[str, str]] = set()

    while pending:
        component_type, name = pending.pop()
        key = (component_type, name)
        if key in visited:
            continue
        visited.add(key)

        value = full_components.get(component_type, {}).get(name)
        if value is None:
            continue
        components.setdefault(component_type, {})[name] = deepcopy(value)
        pending.extend(_component_references(value))

    return components


def _component_references(value: object) -> list[tuple[str, str]]:
    references: list[tuple[str, str]] = []
    if isinstance(value, dict):
        reference = value.get("$ref")
        if isinstance(reference, str) and reference.startswith("#/components/"):
            component_type, _, name = reference.removeprefix("#/components/").partition("/")
            if component_type and name:
                references.append((component_type, name.replace("~1", "/").replace("~0", "~")))
        for child in value.values():
            references.extend(_component_references(child))
    elif isinstance(value, list):
        for child in value:
            references.extend(_component_references(child))
    return references


def _public_components(paths: dict[str, Any], full_components: dict[str, Any]) -> dict[str, Any]:
    components = _referenced_components(paths, full_components)
    credential_kind = components.get("schemas", {}).get("CredentialKind")
    if isinstance(credential_kind, dict):
        credential_kind["description"] = "Credential used by the Direct API Client."
        credential_kind["enum"] = ["personal_api_key"]
    components["securitySchemes"] = {
        "APIKeyHeader": {"in": "header", "name": "X-API-Key", "type": "apiKey"},
    }
    return components


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
                operation["security"] = [{"APIKeyHeader": []}]
        paths[path.removeprefix("/v1")] = projected_item

    schema = {
        "openapi": full_schema["openapi"],
        "info": deepcopy(full_schema["info"]),
        "paths": paths,
        "components": _public_components(paths, full_schema.get("components", {})),
        "servers": [
            {"url": f"{str(application.state.settings.gateway_public_url).rstrip('/')}/v1"}
        ],
        "tags": [
            {
                "name": "auth",
                "description": "Identify the User represented by the Personal API Key.",
                "x-displayName": "Identity",
            },
            {
                "name": "input-files",
                "description": "Create, download, and delete caller-owned Input Files.",
                "x-displayName": "Input Files",
            },
            {
                "name": "jobs",
                "description": "Create and observe caller-owned Jobs.",
                "x-displayName": "Jobs",
            },
        ],
    }
    application.state.public_openapi_schema = schema
    return schema
