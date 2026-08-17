"""REST and MCP authentication with lifespan-owned JWKS transport."""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Annotated

import structlog
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer
from fastmcp.server.auth import RemoteAuthProvider
from fastmcp.server.auth.auth import AccessToken, TokenVerifier
from fastmcp.server.auth.providers.jwt import JWTVerifier
from fastmcp.server.dependencies import get_access_token
from pydantic import AnyHttpUrl

if TYPE_CHECKING:
    import httpx2

    from gateway.core.config import Settings

from gateway.core.errors import AppError
from gateway.core.personal_api_keys import PersonalApiKeyVerificationUnavailableError


class ManagedJWTVerifier(TokenVerifier):
    """JWT verifier whose pooled JWKS client is attached during app startup."""

    def __init__(self, settings: Settings, *, issuer: str, audience: str) -> None:
        super().__init__()
        self._settings = settings
        self._delegate: JWTVerifier | None = None
        self.jwks_uri = settings.auth_jwks_url
        self.issuer = issuer
        self.audience = audience

    def start(self, http_client: httpx2.AsyncClient) -> None:
        """Construct the FastMCP verifier with the app-owned JWKS client."""

        self._delegate = JWTVerifier(
            jwks_uri=self.jwks_uri,
            issuer=self.issuer,
            audience=self.audience,
            algorithm="EdDSA",
            http_client=http_client,
        )

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verify a bearer token through the initialized delegate."""

        if self._delegate is None:
            raise RuntimeError("JWT verifier used outside the application lifespan")  # noqa: TRY003, EM101
        return await self._delegate.verify_token(token)


class CredentialKind(StrEnum):
    """Credential channels normalized into a principal."""

    SESSION_JWT = "session_jwt"
    OAUTH_ACCESS_TOKEN = "oauth_access_token"  # noqa: S105 - This is a credential kind, not a secret.
    PERSONAL_API_KEY = "personal_api_key"


@dataclass(frozen=True, slots=True)
class Principal:
    """Authenticated identity shared by REST and MCP adapters."""

    user_id: str
    credential_kind: CredentialKind
    credential_id: str | None = None


class PrincipalAccessToken(AccessToken):
    """FastMCP access token carrying a normalized principal."""

    principal: Principal


class MCPPrincipalVerifier(TokenVerifier):
    """Translate a verified MCP token into Taskome's principal model."""

    def __init__(self, token_verifier: TokenVerifier) -> None:
        super().__init__(
            base_url=token_verifier.base_url,
            resource_base_url=token_verifier.resource_base_url,
            required_scopes=token_verifier.required_scopes,
        )
        self.token_verifier = token_verifier

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verify an MCP token and bind its normalized principal."""

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


class RESTPrincipalVerifier(TokenVerifier):
    """Normalize either REST session JWTs or CLI OAuth access tokens."""

    def __init__(
        self,
        *,
        session_verifier: TokenVerifier,
        oauth_verifier: TokenVerifier,
    ) -> None:
        super().__init__()
        self.session_verifier = session_verifier
        self.oauth_verifier = oauth_verifier

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verify a REST credential without allowing MCP-audience tokens."""

        session_token = await self.session_verifier.verify_token(token)
        if session_token is not None:
            principal = _principal_from_token(session_token, CredentialKind.SESSION_JWT)
            if principal is not None:
                return PrincipalAccessToken.model_validate(
                    {**session_token.model_dump(), "principal": principal}
                )

        oauth_token = await self.oauth_verifier.verify_token(token)
        if oauth_token is None:
            return None
        principal = _principal_from_token(oauth_token, CredentialKind.OAUTH_ACCESS_TOKEN)
        if principal is None:
            return None
        return PrincipalAccessToken.model_validate(
            {**oauth_token.model_dump(), "principal": principal}
        )


bearer_scheme = HTTPBearer(auto_error=False)
api_key_scheme = APIKeyHeader(name="X-API-Key", auto_error=False)


def create_rest_token_verifier(settings: Settings) -> RESTPrincipalVerifier:
    """Create REST verifiers for Web session JWTs and CLI OAuth access tokens."""

    return RESTPrincipalVerifier(
        session_verifier=ManagedJWTVerifier(
            settings,
            issuer=settings.auth_session_issuer,
            audience=settings.rest_resource,
        ),
        oauth_verifier=ManagedJWTVerifier(
            settings,
            issuer=settings.auth_oauth_issuer,
            audience=settings.rest_resource,
        ),
    )


def create_mcp_token_verifier(settings: Settings) -> MCPPrincipalVerifier:
    """Create an OAuth verifier initialized later by the app lifespan."""

    return MCPPrincipalVerifier(
        ManagedJWTVerifier(
            settings,
            issuer=settings.auth_oauth_issuer,
            audience=settings.mcp_resource,
        )
    )


def create_rest_auth_provider(
    settings: Settings,
    token_verifier: TokenVerifier,
) -> RemoteAuthProvider:
    """Publish OAuth protected-resource metadata for Gateway REST."""

    return RemoteAuthProvider(
        token_verifier=token_verifier,
        authorization_servers=[AnyHttpUrl(settings.auth_oauth_issuer)],
        base_url=settings.gateway_public_url,
        resource_base_url=settings.gateway_public_url,
        scopes_supported=["taskome"],
        resource_name="Taskome REST API",
    )


def create_mcp_auth_provider(
    settings: Settings,
    token_verifier: MCPPrincipalVerifier,
) -> RemoteAuthProvider:
    return RemoteAuthProvider(
        token_verifier=token_verifier,
        authorization_servers=[AnyHttpUrl(settings.auth_oauth_issuer)],
        base_url=settings.gateway_public_url,
        resource_base_url=settings.gateway_public_url,
        scopes_supported=["taskome"],
        resource_name="Taskome MCP",
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
    """Authenticate one unambiguous REST credential and return its principal."""

    if request.headers.get("authorization") is not None and personal_api_key is not None:
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
    if isinstance(token, PrincipalAccessToken):
        principal = token.principal
    else:
        principal = _principal_from_token(token, CredentialKind.SESSION_JWT)
        if principal is None:
            raise _unauthenticated()
    request.state.principal = principal
    _bind_principal(principal)
    return principal


def current_mcp_principal() -> Principal:
    """Return the principal attached to the active MCP tool call."""

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
