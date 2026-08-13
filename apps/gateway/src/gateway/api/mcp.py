from __future__ import annotations

from typing import TYPE_CHECKING

from fastmcp import FastMCP
from fastmcp.server.dependencies import get_access_token

from gateway.core.config import Environment

if TYPE_CHECKING:
    from fastmcp.server.auth import AuthProvider

    from gateway.core.config import Settings
    from gateway.services.input_files import InputFileService


class MCPAuthConfigurationError(RuntimeError):
    """Raised when production MCP transport auth was not configured."""


def create_mcp_server(
    settings: Settings,
    service: InputFileService,
    *,
    auth_provider: AuthProvider | None = None,
) -> FastMCP:
    if auth_provider is None and settings.environment is not Environment.TEST:
        raise MCPAuthConfigurationError
    server = FastMCP(
        name=settings.app_name,
        version=settings.app_version,
        auth=auth_provider,
        mask_error_details=settings.environment is Environment.PRODUCTION,
    )

    @server.tool(name="mint_input_file_upload_url")
    async def mint_input_file_upload_url(original_filename: str) -> dict[str, str]:
        token = get_access_token()
        if token is None or token.subject is None:
            raise PermissionError
        result = await service.mint_upload_url(token.subject, original_filename)
        return {
            "id": str(result.id),
            "upload_url": result.upload_url,
            "expires_at": result.expires_at.isoformat(),
        }

    return server
