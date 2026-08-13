from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastmcp.server.auth.auth import AccessToken  # noqa: TC002
from fastmcp.server.auth.providers.jwt import JWTVerifier

bearer_scheme = HTTPBearer(auto_error=False)


def create_token_verifier(jwks_url: str) -> JWTVerifier:
    return JWTVerifier(jwks_uri=jwks_url, algorithm="RS256")


async def current_access_token(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AccessToken:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    verifier = request.app.state.token_verifier
    token = await verifier.verify_token(credentials.credentials)
    if token is None or token.subject is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return token


async def current_user_id(
    token: Annotated[AccessToken, Depends(current_access_token)],
) -> str:
    if token.subject is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return token.subject
