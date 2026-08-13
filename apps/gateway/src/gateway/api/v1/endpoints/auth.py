from typing import Annotated, Any

from fastapi import APIRouter, Depends

from gateway.core.auth import current_claims
from gateway.core.errors import problem_responses
from gateway.schemas.problem import Identity

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get(
    "/me",
    operation_id="getCurrentIdentity",
    response_model=Identity,
    responses=problem_responses(401),
)
async def current_identity(
    claims: Annotated[dict[str, Any], Depends(current_claims)],
) -> Identity:
    return Identity.model_validate({key: claims[key] for key in ("aud", "iss", "sub")})
