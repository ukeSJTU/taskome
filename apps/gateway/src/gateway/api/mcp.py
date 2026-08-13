"""MCP server assembly over the shared Input File service."""

from __future__ import annotations

from typing import TYPE_CHECKING, Protocol
from uuid import UUID  # noqa: TC003 - FastMCP resolves tool annotations at registration.

from fastmcp import FastMCP

from gateway.core.auth import current_mcp_principal
from gateway.core.config import Environment
from gateway.schemas.input_files import (  # noqa: TC001 - FastMCP resolves annotations at runtime.
    InputFileSize,
    OriginalFilename,
)

if TYPE_CHECKING:
    from fastmcp.server.auth import AuthProvider

    from gateway.core.config import Settings
    from gateway.services.input_files import DownloadUrl, UploadUrl


class MCPInputFileService(Protocol):
    async def mint_upload_url(
        self,
        owner_user_id: str,
        original_filename: str,
        size_bytes: int,
    ) -> UploadUrl: ...

    async def mint_download_url(self, owner_user_id: str, input_file_id: UUID) -> DownloadUrl: ...


def create_mcp_server(
    settings: Settings,
    service: MCPInputFileService,
    *,
    auth_provider: AuthProvider,
) -> FastMCP:
    """Register the Gateway's curated MCP tools and authentication provider."""

    server = FastMCP(
        name=settings.app_name,
        version=settings.app_version,
        auth=auth_provider,
        mask_error_details=settings.app_environment is Environment.PRODUCTION,
    )

    @server.tool(name="prepare_input_file_upload")
    async def prepare_input_file_upload(
        original_filename: OriginalFilename,
        size_bytes: InputFileSize,
    ) -> dict[str, str]:
        """Prepare a one-time upload with signed length and no-overwrite headers."""
        principal = current_mcp_principal()
        result = await service.mint_upload_url(principal.user_id, original_filename, size_bytes)
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
