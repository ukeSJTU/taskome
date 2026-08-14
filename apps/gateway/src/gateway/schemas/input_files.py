"""Strict REST and MCP boundary models for Input Files."""

from datetime import datetime  # noqa: TC003
from typing import Annotated
from uuid import UUID  # noqa: TC003

from pydantic import BaseModel, ConfigDict, Field

MAX_ORIGINAL_FILENAME_LENGTH = 255
MAX_INPUT_FILE_BYTES = 50 * 1024 * 1024
OriginalFilename = Annotated[
    str,
    Field(strict=True, min_length=1, max_length=MAX_ORIGINAL_FILENAME_LENGTH),
]
InputFileSize = Annotated[int, Field(strict=True, ge=1, le=MAX_INPUT_FILE_BYTES)]


class CreateInputFileRequest(BaseModel):
    """Validated REST input for creating an immutable Input File."""

    model_config = ConfigDict(strict=True)

    original_filename: OriginalFilename
    size_bytes: InputFileSize


class UploadUrlResponse(BaseModel):
    """Caller-visible upload id, signed URL, and expiry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    upload_url: Annotated[
        str,
        Field(
            description=(
                "PUT with the declared Content-Length and If-None-Match: *; "
                "both headers are signed."
            )
        ),
    ]
    expires_at: datetime


class DownloadUrlResponse(BaseModel):
    """Caller-visible signed download URL and expiry."""

    model_config = ConfigDict(from_attributes=True)

    download_url: str
    expires_at: datetime
