"""Authenticated caller response models."""

from pydantic import BaseModel, ConfigDict

from gateway.core.auth import CredentialKind  # noqa: TC001 - Pydantic needs the runtime enum.


class Identity(BaseModel):
    """Normalized identity returned by the REST authentication endpoint."""

    model_config = ConfigDict(from_attributes=True)

    user_id: str
    credential_kind: CredentialKind
    credential_id: str | None
