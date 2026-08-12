from __future__ import annotations

from typing import TYPE_CHECKING

from fastmcp import FastMCP

from gateway.core.config import Environment

if TYPE_CHECKING:
    from gateway.core.config import Settings


def create_mcp_server(settings: Settings) -> FastMCP:
    return FastMCP(
        name=settings.app_name,
        version=settings.app_version,
        mask_error_details=settings.environment is Environment.PRODUCTION,
    )
