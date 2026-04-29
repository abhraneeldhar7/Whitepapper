import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from svix.webhooks import Webhook, WebhookVerificationError

from app.core.config import get_settings
from app.services.user_service import user_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _extract_clerk_email(data: dict) -> str | None:
    emailAddresses = data.get("email_addresses") or []
    if isinstance(emailAddresses, list) and emailAddresses:
        first = emailAddresses[0]
        if isinstance(first, dict):
            return first.get("email_address")
    return data.get("email")

def _extract_clerk_avatar(data: dict) -> str | None:
    imageUrl = data.get("image_url")
    if isinstance(imageUrl, str) and imageUrl:
        return imageUrl
    profileImageUrl = data.get("profile_image_url")
    if isinstance(profileImageUrl, str) and profileImageUrl:
        return profileImageUrl
    avatarUrl = data.get("avatar_url")
    if isinstance(avatarUrl, str) and avatarUrl:
        return avatarUrl
    return None

def _extract_clerk_description(data: dict) -> str:
    unsafeMetadata = data.get("unsafe_metadata")
    if isinstance(unsafeMetadata, dict):
        description = unsafeMetadata.get("description")
        if isinstance(description, str):
            return description
    publicMetadata = data.get("public_metadata")
    if isinstance(publicMetadata, dict):
        description = publicMetadata.get("description")
        if isinstance(description, str):
            return description
    return ""


@router.post("/clerk")
async def clerk_webhook(request: Request) -> JSONResponse:
    settings = get_settings()

    svixId = request.headers.get("svix-id")
    svixTimestamp = request.headers.get("svix-timestamp")
    svixSignature = request.headers.get("svix-signature")
    if not svixId or not svixTimestamp or not svixSignature:
        raise HTTPException(status_code=400, detail="Missing Svix headers.")

    payload = (await request.body()).decode("utf-8")
    headers = {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
    }

    try:
        event = Webhook(settings.clerk_webhook_signing_secret).verify(payload, headers)
    except WebhookVerificationError as exc:
        logger.warning("Clerk webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid webhook signature.") from exc

    eventType = event.get("type")
    data = event.get("data", {})
    userId = data.get("id")

    if eventType == "user.created" and userId:
        try:
            email = _extract_clerk_email(data)
            user_service.create_user(
                userId=userId,
                username=data.get("username"),
                displayName=data.get("first_name") or data.get("full_name"),
                description=_extract_clerk_description(data),
                email=email,
                avatarUrl=_extract_clerk_avatar(data),
            )
        except HTTPException as exc:
            if exc.status_code in {404, 409}:
                logger.warning(
                    "Skipping Clerk user.created provisioning for %s: %s",
                    userId,
                    exc.detail,
                )
            else:
                raise
    elif eventType == "user.updated" and userId:
        logger.info("Ignoring Clerk webhook type=%s id=%s", eventType, userId)
    elif eventType == "user.deleted" and userId:
        deleted = user_service.delete_user(userId)
        logger.info("Deleted user %s dependencies: %s", userId, deleted)

    logger.info("Processed Clerk webhook type=%s id=%s", eventType, userId)
    return JSONResponse({"ok": True})
