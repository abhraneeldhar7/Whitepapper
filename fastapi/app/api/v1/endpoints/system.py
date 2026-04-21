import hmac

from fastapi import APIRouter, HTTPException, Request

from app.core.config import get_settings
from app.services._dev_api_service import _dev_api_service
from app.services.mcp_auth import mcp_authorization_service

router = APIRouter(tags=["system"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"msg":"we cooking gng 🔥"}


@router.post("/reset-api-usage")
def reset_api_usage(request: Request) -> dict[str, object]:
    settings = get_settings()
    cron_secret = request.headers.get("x-cron-secret", "")
    if not settings.cron_secret or not hmac.compare_digest(
        cron_secret.encode("utf-8"), settings.cron_secret.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized.")
    api_keys_reset = _dev_api_service.reset_all_usage()
    mcp_usage_reset = mcp_authorization_service.reset_all_usage()
    return {
        "ok": True,
        "reset": api_keys_reset + mcp_usage_reset,
        "apiKeysReset": api_keys_reset,
        "mcpUsageReset": mcp_usage_reset,
    }


@router.post("/sync-api-keys-cache")
def sync_api_keys_cache(request: Request) -> dict[str, object]:
    settings = get_settings()
    cron_secret = request.headers.get("x-cron-secret", "")
    if not settings.cron_secret or not hmac.compare_digest(
        cron_secret.encode("utf-8"), settings.cron_secret.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Unauthorized.")
    api_keys_synced = _dev_api_service.sync_cache_with_firestore()
    return {"ok": True, "synced": api_keys_synced, "apiKeysSynced": api_keys_synced, "mcpTokensSynced": 0}
