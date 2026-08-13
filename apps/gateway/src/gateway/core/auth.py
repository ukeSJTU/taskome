from __future__ import annotations

import time
from typing import TYPE_CHECKING, Annotated, Any

import httpx
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastmcp.server.auth.auth import AccessToken  # noqa: TC002
from fastmcp.server.auth.providers.jwt import JWTVerifier

if TYPE_CHECKING:
    from collections.abc import Mapping


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


class InvalidJWKSError(ValueError):
    pass


class JWKSVerifier:
    def __init__(
        self,
        jwks_url: str,
        *,
        issuers: list[str],
        audiences: list[str],
        client: httpx.AsyncClient | None = None,
        cache_ttl: float = 300,
    ) -> None:
        self.jwks_url = jwks_url
        self.issuers = issuers
        self.audiences = audiences
        self.client = client
        self.cache_ttl = cache_ttl
        self._cached_jwks: Mapping[str, Any] | None = None
        self._cached_at = 0.0

    async def verify_bearer(self, authorization: str | None) -> dict[str, Any]:
        token = self._extract_token(authorization)
        try:
            header = jwt.get_unverified_header(token)
            self._validate_header(header)
            jwk = await self._find_key(header["kid"])
            payload = jwt.decode(
                token,
                jwt.PyJWK.from_dict(jwk).key,
                algorithms=["EdDSA"],
                audience=self.audiences,
                issuer=self.issuers,
            )
        except (httpx.HTTPError, jwt.PyJWTError, KeyError, TypeError, InvalidJWKSError) as error:
            raise self._unauthorized() from error
        return payload

    async def _find_key(self, key_id: str) -> dict[str, Any]:
        jwks = await self._get_jwks()
        for key in jwks.get("keys", []):
            if key.get("kid") == key_id:
                return key
        jwks = await self._get_jwks(force=True)
        for key in jwks.get("keys", []):
            if key.get("kid") == key_id:
                return key
        raise KeyError(key_id)

    async def _get_jwks(self, *, force: bool = False) -> dict[str, Any]:
        now = time.monotonic()
        if not force and self._cached_jwks is not None and now - self._cached_at < self.cache_ttl:
            return dict(self._cached_jwks)
        if self.client is None:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self.jwks_url)
        else:
            response = await self.client.get(self.jwks_url)
        response.raise_for_status()
        try:
            jwks = response.json()
        except ValueError as error:
            raise InvalidJWKSError from error
        if not isinstance(jwks, dict) or not isinstance(jwks.get("keys"), list):
            raise InvalidJWKSError
        self._cached_jwks = jwks
        self._cached_at = now
        return jwks

    @staticmethod
    def _extract_token(authorization: str | None) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise JWKSVerifier._unauthorized()
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            raise JWKSVerifier._unauthorized()
        return token

    @staticmethod
    def _validate_header(header: dict[str, Any]) -> None:
        if header.get("alg") != "EdDSA" or not header.get("kid"):
            raise InvalidJWKSError

    @staticmethod
    def _unauthorized() -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid bearer token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_auth(request: Request) -> dict[str, Any]:
    verifier: JWKSVerifier = request.app.state.auth_verifier
    return await verifier.verify_bearer(request.headers.get("authorization"))
