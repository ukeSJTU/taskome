from fastapi import APIRouter

from gateway.api.v1.endpoints.input_files import router as input_files_router

router = APIRouter(prefix="/api/v1")
router.include_router(input_files_router)
