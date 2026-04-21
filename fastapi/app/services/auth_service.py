from __future__ import annotations

from functools import lru_cache

from clerk_backend_api import AuthenticateRequestOptions, Clerk
from fastapi import HTTPException, Request

from app.core.config import Settings, get_settings

def _parse_authorized_parties(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]


@lru_cache
def _clerk_client() -> Clerk:
    settings = get_settings()
    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=500,
            detail="Server auth is not configured. Set CLERK_SECRET_KEY.",
        )
    return Clerk(bearer_auth=settings.clerk_secret_key)


@lru_cache
def _auth_options() -> AuthenticateRequestOptions:
    settings: Settings = get_settings()
    return AuthenticateRequestOptions(
        authorized_parties=_parse_authorized_parties(settings.clerk_authorized_parties),
        jwt_key=settings.clerk_jwt_key,
    )


def _verify_request_and_get_user_id(request: Request) -> str:
    request_state = _clerk_client().authenticate_request(request, _auth_options())

    if not request_state.is_signed_in:
        detail = request_state.message or "Invalid token"
        raise HTTPException(status_code=401, detail=detail)

    user_id = (request_state.payload or {}).get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="No user ID in token")

    return user_id


def maybe_get_verified_id(request: Request) -> str | None:
    try:
        return _verify_request_and_get_user_id(request)
    except HTTPException:
        return None


async def get_verified_id(
    request: Request,
) -> str:
    return _verify_request_and_get_user_id(request)
