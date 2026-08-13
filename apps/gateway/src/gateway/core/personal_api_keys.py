from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError, model_validator

_ACTIVE_IDENTITY_ERROR = "active verification requires User and key ids"
_INACTIVE_IDENTITY_ERROR = "inactive verification cannot expose identity"

if TYPE_CHECKING:
    from collections.abc import Callable


class PersonalApiKeyVerificationUnavailableError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class VerifiedPersonalApiKey:
    user_id: str
    key_id: str


class PersonalApiKeyVerifier(Protocol):
    async def verify(self, key: str) -> VerifiedPersonalApiKey | None: ...

    async def aclose(self) -> None: ...


class _VerificationResponse(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    active: bool
    user_id: str | None
    key_id: str | None

    @model_validator(mode="after")
    def validate_identity(self) -> _VerificationResponse:
        if self.active and (not self.user_id or not self.key_id):
            raise ValueError(_ACTIVE_IDENTITY_ERROR)
        if not self.active and (self.user_id is not None or self.key_id is not None):
            raise ValueError(_INACTIVE_IDENTITY_ERROR)
        return self


class WebPersonalApiKeyVerifier:
    def __init__(
        self,
        *,
        url: str,
        secret: str,
        client: httpx.AsyncClient | None = None,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self._url = url
        self._secret = secret.encode()
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(5, connect=2))
        self._owns_client = client is None
        self._clock = clock

    async def verify(self, key: str) -> VerifiedPersonalApiKey | None:
        body = json.dumps({"key": key}, separators=(",", ":")).encode()
        timestamp = str(int(self._clock()))
        signature = hmac.new(
            self._secret,
            timestamp.encode() + b"." + body,
            hashlib.sha256,
        ).hexdigest()
        try:
            response = await self._client.post(
                self._url,
                content=body,
                headers={
                    "Content-Type": "application/json",
                    "X-Taskome-Signature": signature,
                    "X-Taskome-Timestamp": timestamp,
                },
            )
            response.raise_for_status()
            result = _VerificationResponse.model_validate(response.json())
        except (httpx.HTTPError, ValueError, ValidationError) as error:
            raise PersonalApiKeyVerificationUnavailableError from error

        if not result.active:
            return None
        if result.user_id is None or result.key_id is None:
            raise PersonalApiKeyVerificationUnavailableError
        return VerifiedPersonalApiKey(user_id=result.user_id, key_id=result.key_id)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
