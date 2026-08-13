from fastapi import APIRouter

from gateway.api.v1.endpoints.auth import router as auth_router

router = APIRouter(prefix="/api/v1")
router.include_router(auth_router)
