import time
from urllib.parse import urlsplit, urlunsplit

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.services.auth_service import get_verified_id
from app.schemas.users import UserProfile
from app.schemas.entities import DashboardPayload
from app.core.constants import (
    MAX_PROFILE_IMAGE_HEIGHT,
    MAX_PROFILE_IMAGE_WIDTH,
)
from app.services.storage_service import storage_service
from app.services.user_service import user_service
from app.services.projects_service import projects_service
from app.services.papers_service import papers_service

router = APIRouter(prefix="/users", tags=["users"])


def _with_cache_buster(url: str) -> str:
    parts = urlsplit(url)
    if parts.query:
        return url
    stamp = int(time.time() * 1000)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, f"time={stamp}", ""))


@router.get("/me", response_model=UserProfile)
def get_me(user_id: str = Depends(get_verified_id)) -> UserProfile:

    try:
        return user_service.get_by_id(user_id)
    except HTTPException as exc:
        if exc.status_code != 404:
            raise
        # Auto-provision the profile if webhook delivery was delayed/missed.
        return user_service.create_user(
            user_id=user_id,
        )


@router.patch("/me", response_model=UserProfile)
def patch_me(
    payload: UserProfile,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    return user_service.update_user(
        user_id,
        payload.model_dump(),
    )


@router.delete("/me")
def delete_me(user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
    user_service.delete_user(user_id)
    return {"ok": True}


@router.post("/me/profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    url = await storage_service.upload_image(
        f"users/{user_id}/profile/avatar",
        file,
        max_width=MAX_PROFILE_IMAGE_WIDTH,
        max_height=MAX_PROFILE_IMAGE_HEIGHT,
        crop=True,
        overwrite_name="avatar",
    )
    url = _with_cache_buster(url)
    user_service.update_user(user_id, {"avatarUrl": url})
    return {"url": url}


@router.get("/username/available")
def check_username_available(
    username: str = Query(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, bool]:
    return {"available": user_service.is_username_available(username, user_id)}


@router.get("/dashboard", response_model=DashboardPayload)
def get_dashboard_data(user_id: str = Depends(get_verified_id)) -> DashboardPayload:
    """Get all dashboard data: user profile, projects, and standalone papers (public/draft), sorted by updatedAt."""
    user = user_service.get_by_id(user_id)
    projects = projects_service.list_owned(user_id)
    standalone_papers = papers_service.list_owned_filtered(owner_id=user_id, standalone=True)

    # Sort by updatedAt in descending order
    projects.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    standalone_papers.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)

    return DashboardPayload(
        user=user,
        projects=projects,
        papers=standalone_papers,
    )


@router.get("/{username}", response_model=UserProfile)
def get_user_by_username(username: str) -> UserProfile:
    return user_service.get_by_username(username)
