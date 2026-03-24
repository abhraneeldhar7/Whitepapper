import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import get_settings
from app.services.user_service import user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _extract_clerk_email(data: dict) -> str | None:
    email_addresses = data.get("email_addresses") or []
    if isinstance(email_addresses, list) and email_addresses:
        first = email_addresses[0]
        if isinstance(first, dict):
            return first.get("email_address")
    return data.get("email")

def _extract_clerk_avatar(data: dict) -> str | None:
    image_url = data.get("image_url")
    if isinstance(image_url, str) and image_url:
        return image_url
    profile_image_url = data.get("profile_image_url")
    if isinstance(profile_image_url, str) and profile_image_url:
        return profile_image_url
    avatar_url = data.get("avatar_url")
    if isinstance(avatar_url, str) and avatar_url:
        return avatar_url
    return None

def _generate_default_username(email: str | None, username: str | None = None) -> str | None:
    """Generate default username from email prefix or use provided username."""
    if username:
        return username
    if email and "@" in email:
        return email.split("@", 1)[0]
    return None


def _extract_clerk_description(data: dict) -> str:
    unsafe_metadata = data.get("unsafe_metadata")
    if isinstance(unsafe_metadata, dict):
        description = unsafe_metadata.get("description")
        if isinstance(description, str):
            return description
    public_metadata = data.get("public_metadata")
    if isinstance(public_metadata, dict):
        description = public_metadata.get("description")
        if isinstance(description, str):
            return description
    return ""


@router.post("/clerk")
async def clerk_webhook(request: Request) -> JSONResponse:
    settings = get_settings()

    svix_id = request.headers.get("svix-id")
    svix_timestamp = request.headers.get("svix-timestamp")
    svix_signature = request.headers.get("svix-signature")
    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=400, detail="Missing Svix headers.")

    payload = (await request.body()).decode("utf-8")
    headers = {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
    }

    try:
        event = Webhook(settings.clerk_webhook_signing_secret).verify(payload, headers)
    except WebhookVerificationError as exc:
        logger.warning("Clerk webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook signature.") from exc

    event_type = event.get("type")
    data = event.get("data", {})
    user_id = data.get("id")

    if event_type == "user.created" and user_id:
        try:
            email = _extract_clerk_email(data)
            default_username = _generate_default_username(email, data.get("username"))
            user_service.create_user(
                user_id=user_id,
                username=default_username,
                display_name=data.get("first_name") or data.get("full_name"),
                description=_extract_clerk_description(data),
                email=email,
                avatar_url=_extract_clerk_avatar(data),
            )
        except HTTPException as exc:
            if exc.status_code in {404, 409}:
                logger.warning(
                    "Skipping Clerk user.created provisioning for %s: %s",
                    user_id,
                    exc.detail,
                )
            else:
                raise
    elif event_type == "user.updated" and user_id:
        logger.info("Ignoring Clerk webhook type=%s id=%s", event_type, user_id)
    elif event_type == "user.deleted" and user_id:
        deleted = user_service.delete_user(user_id)
        logger.info("Deleted user %s dependencies: %s", user_id, deleted)

    logger.info("Processed Clerk webhook type=%s id=%s", event_type, user_id)
    return JSONResponse({"ok": True})
