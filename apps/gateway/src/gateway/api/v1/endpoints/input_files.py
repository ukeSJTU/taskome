from __future__ import annotations

from typing import Annotated
from uuid import UUID  # noqa: TC003

from fastapi import APIRouter, Depends, Request, status

from gateway.core.auth import Principal, current_principal
from gateway.core.errors import AppError, problem_responses
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


@router.post(
    "",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="createInputFile",
    responses=problem_responses(400, 401, 422, 503),
)
async def create_input_file(
    body: CreateInputFileRequest,
    principal: Annotated[Principal, Depends(current_principal)],
    service: Annotated[InputFileService, Depends(input_file_service)],
) -> UploadUrlResponse:
    result = await service.mint_upload_url(principal.user_id, body.original_filename)
    return UploadUrlResponse.model_validate(result, from_attributes=True)


@router.get(
    "/{input_file_id}/download-url",
    response_model=DownloadUrlResponse,
    name="download_input_file_url",
    operation_id="getInputFileDownloadUrl",
    responses=problem_responses(400, 401, 404, 422, 503),
)
async def download_input_file(
    input_file_id: UUID,
    principal: Annotated[Principal, Depends(current_principal)],
    service: Annotated[InputFileService, Depends(input_file_service)],
) -> DownloadUrlResponse:
    try:
        result = await service.mint_download_url(principal.user_id, input_file_id)
    except InputFileNotFoundError as error:
        raise input_file_not_found() from error
    return DownloadUrlResponse.model_validate(result, from_attributes=True)


@router.delete(
    "/{input_file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteInputFile",
    responses=problem_responses(400, 401, 404, 422, 503),
)
async def delete_input_file(
    input_file_id: UUID,
    principal: Annotated[Principal, Depends(current_principal)],
    service: Annotated[InputFileService, Depends(input_file_service)],
) -> None:
    try:
        await service.delete(principal.user_id, input_file_id)
    except InputFileNotFoundError as error:
        raise input_file_not_found() from error
