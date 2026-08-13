from fastapi import APIRouter

from gateway.api.v1.endpoints.auth import router as auth_endpoint_router
from gateway.api.v1.endpoints.input_files import router as input_files_router

router = APIRouter(prefix="/v1")
router.include_router(input_files_router)

auth_api_router = APIRouter(prefix="/api/v1")
auth_api_router.include_router(auth_endpoint_router)
