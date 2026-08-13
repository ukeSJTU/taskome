from __future__ import annotations

from typing import Annotated
from uuid import UUID  # noqa: TC003

from fastapi import APIRouter, Depends, Request, status

from gateway.core.auth import current_user_id
from gateway.core.errors import AppError
from gateway.schemas.input_files import (
    CreateInputFileRequest,
    DownloadUrlResponse,
    UploadUrlResponse,
)
from gateway.services.input_files import InputFileNotFoundError, InputFileService

router = APIRouter(prefix="/input-files", tags=["input-files"])


def input_file_service(request: Request) -> InputFileService:
    return request.app.state.input_file_service


def input_file_not_found() -> AppError:
    return AppError(
        error_type="input-file-not-found",
        title="Input File Not Found",
        status_code=status.HTTP_404_NOT_FOUND,
        detail="The requested Input File is not available.",
    )


@router.post("", response_model=UploadUrlResponse, status_code=status.HTTP_201_CREATED)
async def create_input_file(
    body: CreateInputFileRequest,
    owner_user_id: Annotated[str, Depends(current_user_id)],
    service: Annotated[InputFileService, Depends(input_file_service)],
) -> UploadUrlResponse:
    result = await service.mint_upload_url(owner_user_id, body.original_filename)
    return UploadUrlResponse.model_validate(result, from_attributes=True)


@router.get(
    "/{input_file_id}/download-url",
    response_model=DownloadUrlResponse,
    name="download_input_file_url",
)
async def download_input_file(
    input_file_id: UUID,
    owner_user_id: Annotated[str, Depends(current_user_id)],
    service: Annotated[InputFileService, Depends(input_file_service)],
) -> DownloadUrlResponse:
    try:
        result = await service.mint_download_url(owner_user_id, input_file_id)
    except InputFileNotFoundError as error:
        raise input_file_not_found() from error
    return DownloadUrlResponse.model_validate(result, from_attributes=True)


@router.delete("/{input_file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_input_file(
    input_file_id: UUID,
    owner_user_id: Annotated[str, Depends(current_user_id)],
    service: Annotated[InputFileService, Depends(input_file_service)],
) -> None:
    try:
        await service.delete(owner_user_id, input_file_id)
    except InputFileNotFoundError as error:
        raise input_file_not_found() from error
