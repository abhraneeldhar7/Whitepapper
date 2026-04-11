from fastapi import APIRouter

from app.api.v1.endpoints.distributions.devto import router as devto_router
from app.api.v1.endpoints.distributions.hashnode import router as hashnode_router

router = APIRouter(prefix="/distributions", tags=["distributions"])
router.include_router(hashnode_router)
router.include_router(devto_router)
