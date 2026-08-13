from typing import Annotated, Any

from fastapi import APIRouter, Depends

from gateway.core.auth import current_claims

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me")
async def current_identity(
    claims: Annotated[dict[str, Any], Depends(current_claims)],
) -> dict[str, Any]:
    return {key: claims[key] for key in ("aud", "iss", "sub")}
