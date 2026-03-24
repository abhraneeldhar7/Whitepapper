import hmac

from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
from app.services._dev_api_service import _dev_api_service

router = APIRouter(tags=["system"])


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/reset-api-usage")
async def reset_api_usage(request: Request) -> dict[str, object]:
    settings = get_settings()
    cron_secret = request.headers.get("x-cron-secret", "")
    if not settings.cron_secret or not hmac.compare_digest(
        cron_secret.encode("utf-8"), settings.cron_secret.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized.")
    count = _dev_api_service.reset_all_usage()
    return {"ok": True, "reset": count}
