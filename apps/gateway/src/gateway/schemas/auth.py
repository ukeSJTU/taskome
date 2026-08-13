from pydantic import BaseModel

from gateway.core.auth import CredentialKind  # noqa: TC001 - Pydantic needs the runtime enum.


class Identity(BaseModel):
    user_id: str
    credential_kind: CredentialKind
    credential_id: str | None
