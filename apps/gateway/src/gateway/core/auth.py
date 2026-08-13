from __future__ import annotations

from typing import TYPE_CHECKING, Annotated, Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastmcp.server.auth.auth import AccessToken  # noqa: TC002
from fastmcp.server.auth.providers.jwt import JWTVerifier

if TYPE_CHECKING:
    from gateway.core.config import Settings


bearer_scheme = HTTPBearer(auto_error=False)


def create_token_verifier(settings: Settings) -> JWTVerifier:
    """The single JWT verifier used for every caller (ADR-0003): REST
    endpoints, /api/v1/auth/me, and MCP, all against the same JWKS. The
    algorithm must match what better-auth's jwt() plugin actually signs —
    EdDSA by default, since packages/auth/src/index.ts doesn't set
    jwks.keyPairConfig.alg."""
    return JWTVerifier(
        jwks_uri=settings.auth_jwks_url,
        issuer=[settings.auth_issuer, settings.auth_oauth_issuer],
        audience=[settings.auth_session_audience, settings.auth_oauth_audience],
        algorithm="EdDSA",
    )


async def current_access_token(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AccessToken:
    if credentials is None:
        raise _unauthenticated()
    verifier = request.app.state.token_verifier
    token = await verifier.verify_token(credentials.credentials)
    if token is None or token.subject is None:
        raise _unauthenticated()
    return token


def _unauthenticated() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def current_user_id(
    token: Annotated[AccessToken, Depends(current_access_token)],
) -> str:
    if token.subject is None:
        raise _unauthenticated()
    return token.subject


async def current_claims(
    token: Annotated[AccessToken, Depends(current_access_token)],
) -> dict[str, Any]:
    return token.claims
