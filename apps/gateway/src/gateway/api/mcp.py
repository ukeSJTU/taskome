"""MCP server assembly: the shared Input File service, plus one dynamic tool per Task."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, Protocol
from uuid import UUID  # noqa: TC003 - FastMCP resolves tool annotations at registration.

from fastmcp import FastMCP
from fastmcp.tools.base import Tool, ToolResult
from pydantic import PrivateAttr

from gateway.core.auth import current_mcp_principal
from gateway.core.config import Environment
from gateway.models.jobs import JobStatus
from gateway.schemas.input_files import (  # noqa: TC001 - FastMCP resolves annotations at runtime.
    InputFileSize,
    OriginalFilename,
)
from gateway.services.jobs import (
    InvalidJobParamsError,
    JobInputFileNotFoundError,
    TaskNotFoundError,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from fastmcp.server.auth import AuthProvider

    from gateway.core.config import Settings
    from gateway.repositories.jobs import JobRecord
    from gateway.services.input_files import DownloadUrl, UploadUrl
    from gateway.services.task_manifests import TaskManifest, TaskManifestRegistry


class MCPInputFileService(Protocol):
    async def mint_upload_url(
        self,
        owner_user_id: str,
        original_filename: str,
        size_bytes: int,
    ) -> UploadUrl: ...

    async def mint_download_url(self, owner_user_id: str, input_file_id: UUID) -> DownloadUrl: ...


class MCPJobService(Protocol):
    async def submit_job_and_wait(
        self,
        owner_user_id: str,
        task_server_name: str,
        task_name: str,
        params: dict[str, Any],
    ) -> JobRecord: ...


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


class _JobTaskTool(Tool):
    """One dynamically-registered MCP tool, named and shaped after a single Task."""

    _handler: Callable[[dict[str, Any]], Awaitable[ToolResult]] = PrivateAttr()

    def __init__(
        self,
        *,
        manifest: TaskManifest,
        handler: Callable[[dict[str, Any]], Awaitable[ToolResult]],
    ) -> None:
        super().__init__(
            name=manifest.task_name,
            description=manifest.description,
            parameters=manifest.params_schema,
            output_schema={
                "type": "object",
                "required": ["value", "outputs"],
                "properties": {
                    "value": manifest.result_schema,
                    "outputs": {"type": "array"},
                },
                "additionalProperties": False,
            },
        )
        self._handler = handler

    async def run(self, arguments: dict[str, Any]) -> ToolResult:
        return await self._handler(arguments)


def _mcp_error(code: str, message: str) -> ToolResult:
    return ToolResult(content=message, meta={"taskome": {"error_code": code}}, is_error=True)


def _task_handler(
    job_service: MCPJobService,
    task_server_name: str,
    task_name: str,
) -> Callable[[dict[str, Any]], Awaitable[ToolResult]]:
    async def call_task(arguments: dict[str, Any]) -> ToolResult:
        """Submit and block on one Job, mirroring calling the Task Server's own MCP tool."""
        principal = current_mcp_principal()
        try:
            record = await job_service.submit_job_and_wait(
                principal.user_id, task_server_name, task_name, arguments
            )
        except TaskNotFoundError:
            return _mcp_error("task_not_found", "Task not found.")
        except InvalidJobParamsError as error:
            return _mcp_error("invalid_input", str(error))
        except JobInputFileNotFoundError as error:
            return _mcp_error("input_file_not_found", str(error))
        if record.status is JobStatus.FAILED:
            detail = record.error_detail or {}
            return _mcp_error(
                str(detail.get("error_type", "compute_failed")),
                str(detail.get("detail", "Task execution failed.")),
            )
        envelope = record.result or {}
        return ToolResult(
            content=json.dumps(envelope, separators=(",", ":")),
            structured_content=envelope,
        )

    return call_task


def register_task_tools(
    mcp_server: FastMCP,
    job_service: MCPJobService,
    manifests: TaskManifestRegistry,
) -> None:
    """Register one MCP tool per known Task, named for the Task itself.

    Called once during lifespan startup, after the Task manifest registry is fetched
    -- a Task Server's Tasks become callable through Gateway's MCP surface only once
    its manifest has been discovered. Each tool call blocks until the Job it creates
    reaches a terminal state, mirroring calling the Task Server's own MCP tool
    directly -- an MCP caller expects one call to return the actual result, not a
    Job id to poll.
    """

    for server_name, tasks in manifests.items():
        for task_name, manifest in tasks.items():
            mcp_server.add_tool(
                _JobTaskTool(
                    manifest=manifest,
                    handler=_task_handler(job_service, server_name, task_name),
                )
            )
