from typing import Annotated

from fastapi import APIRouter, Depends

from gateway.core.auth import Principal, current_principal
from gateway.core.errors import problem_responses
from gateway.schemas.auth import Identity

router = APIRouter(tags=["auth"])


@router.get(
    "/me",
    operation_id="getCurrentIdentity",
    response_model=Identity,
    responses=problem_responses(400, 401, 503),
)
async def current_identity(
    principal: Annotated[Principal, Depends(current_principal)],
) -> Identity:
    return Identity.model_validate(principal, from_attributes=True)
