from datetime import datetime  # noqa: TC003
from uuid import UUID  # noqa: TC003

from pydantic import BaseModel, Field


class CreateInputFileRequest(BaseModel):
    original_filename: str = Field(min_length=1)


class UploadUrlResponse(BaseModel):
    id: UUID
    upload_url: str = Field(
        description="PUT with If-None-Match: *; the condition prevents overwrites."
    )
    expires_at: datetime


class DownloadUrlResponse(BaseModel):
    download_url: str
    expires_at: datetime
