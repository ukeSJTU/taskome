from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Annotated

import structlog
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from fastmcp.server.auth.auth import AccessToken, TokenVerifier
from fastmcp.server.auth.providers.jwt import JWTVerifier
from fastmcp.server.dependencies import get_access_token

if TYPE_CHECKING:
    from gateway.core.config import Settings

from gateway.core.errors import AppError
from gateway.core.personal_api_keys import PersonalApiKeyVerificationUnavailableError


class CredentialKind(StrEnum):
    SESSION_JWT = "session_jwt"
    OAUTH_ACCESS_TOKEN = "oauth_access_token"  # noqa: S105 - This is a credential kind, not a secret.
    PERSONAL_API_KEY = "personal_api_key"


@dataclass(frozen=True, slots=True)
class Principal:
    user_id: str
    credential_kind: CredentialKind
    credential_id: str | None = None


class PrincipalAccessToken(AccessToken):
    principal: Principal


class MCPPrincipalVerifier(TokenVerifier):
    def __init__(self, token_verifier: TokenVerifier) -> None:
        super().__init__(
            base_url=token_verifier.base_url,
            resource_base_url=token_verifier.resource_base_url,
            required_scopes=token_verifier.required_scopes,
        )
        self.token_verifier = token_verifier

    async def verify_token(self, token: str) -> AccessToken | None:
        access_token = await self.token_verifier.verify_token(token)
        if access_token is None:
            return None
        principal = _principal_from_token(access_token, CredentialKind.OAUTH_ACCESS_TOKEN)
        if principal is None:
            return None
        _bind_principal(principal)
        return PrincipalAccessToken.model_validate(
            {**access_token.model_dump(), "principal": principal}
        )


bearer_scheme = HTTPBearer(auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


def create_rest_token_verifier(settings: Settings) -> JWTVerifier:
    return JWTVerifier(
        jwks_uri=settings.auth_jwks_url,
        issuer=settings.auth_session_issuer,
        audience=settings.rest_resource,
        algorithm="EdDSA",
    )


def create_mcp_token_verifier(settings: Settings) -> MCPPrincipalVerifier:
    return MCPPrincipalVerifier(
        JWTVerifier(
            jwks_uri=settings.auth_jwks_url,
            issuer=settings.auth_oauth_issuer,
            audience=settings.mcp_resource,
            algorithm="EdDSA",
        )
    )


def _principal_from_token(
    token: AccessToken,
    credential_kind: CredentialKind,
) -> Principal | None:
    if token.subject is None:
        return None
    credential_id = None
    if credential_kind is CredentialKind.OAUTH_ACCESS_TOKEN:
        candidate = token.claims.get("azp") or token.claims.get("client_id")
        if not isinstance(candidate, str) or not candidate:
            return None
        credential_id = candidate
    return Principal(
        user_id=token.subject,
        credential_kind=credential_kind,
        credential_id=credential_id,
    )


def _bind_principal(principal: Principal) -> None:
    structlog.contextvars.bind_contextvars(
        user_id=principal.user_id,
        credential_kind=principal.credential_kind.value,
        credential_id=principal.credential_id,
    )


async def current_principal(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    personal_api_key: Annotated[str | None, Depends(api_key_scheme)],
) -> Principal:
    if credentials is not None and personal_api_key is not None:
        raise AppError(
            error_type="ambiguous-credentials",
            title="Ambiguous Credentials",
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either Authorization or X-API-Key, not both.",
        )
    if personal_api_key is not None:
        try:
            verified_key = await request.app.state.personal_api_key_verifier.verify(
                personal_api_key
            )
        except PersonalApiKeyVerificationUnavailableError as error:
            raise AppError(
                error_type="personal-api-key-verifier-unavailable",
                title="Personal API Key Verifier Unavailable",
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Personal API Key verification is temporarily unavailable.",
            ) from error
        if verified_key is None:
            raise _unauthenticated()
        principal = Principal(
            user_id=verified_key.user_id,
            credential_kind=CredentialKind.PERSONAL_API_KEY,
            credential_id=verified_key.key_id,
        )
        request.state.principal = principal
        _bind_principal(principal)
        return principal
    if credentials is None:
        raise _unauthenticated()
    verifier = request.app.state.rest_token_verifier
    token = await verifier.verify_token(credentials.credentials)
    if token is None:
        raise _unauthenticated()
    principal = _principal_from_token(token, CredentialKind.SESSION_JWT)
    if principal is None:
        raise _unauthenticated()
    request.state.principal = principal
    _bind_principal(principal)
    return principal


def current_mcp_principal() -> Principal:
    token = get_access_token()
    if not isinstance(token, PrincipalAccessToken):
        raise PermissionError
    _bind_principal(token.principal)
    return token.principal


def _unauthenticated() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
