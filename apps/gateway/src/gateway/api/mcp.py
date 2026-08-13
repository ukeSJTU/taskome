from __future__ import annotations

from typing import TYPE_CHECKING, Protocol
from uuid import UUID  # noqa: TC003 - FastMCP resolves tool annotations at registration.

from fastmcp import FastMCP

from gateway.core.auth import current_mcp_principal
from gateway.core.config import Environment

if TYPE_CHECKING:
    from fastmcp.server.auth import AuthProvider

    from gateway.core.config import Settings
    from gateway.services.input_files import DownloadUrl, UploadUrl


class MCPInputFileService(Protocol):
    async def mint_upload_url(self, owner_user_id: str, original_filename: str) -> UploadUrl: ...

    async def mint_download_url(self, owner_user_id: str, input_file_id: UUID) -> DownloadUrl: ...


def create_mcp_server(
    settings: Settings,
    service: MCPInputFileService,
    *,
    auth_provider: AuthProvider,
) -> FastMCP:
    server = FastMCP(
        name=settings.app_name,
        version=settings.app_version,
        auth=auth_provider,
        mask_error_details=settings.app_environment is Environment.PRODUCTION,
    )

    @server.tool(name="prepare_input_file_upload")
    async def prepare_input_file_upload(original_filename: str) -> dict[str, str]:
        """Prepare a one-time upload; PUT must include If-None-Match: *."""
        principal = current_mcp_principal()
        result = await service.mint_upload_url(principal.user_id, original_filename)
        return {
            "id": str(result.id),
            "upload_url": result.upload_url,
            "expires_at": result.expires_at.isoformat(),
        }

    @server.tool(name="prepare_input_file_download")
    async def prepare_input_file_download(input_file_id: UUID) -> dict[str, str]:
        """Prepare a short-lived download for an owned Input File."""
        principal = current_mcp_principal()
        result = await service.mint_download_url(principal.user_id, input_file_id)
        return {
            "download_url": result.download_url,
            "expires_at": result.expires_at.isoformat(),
        }

    return server
