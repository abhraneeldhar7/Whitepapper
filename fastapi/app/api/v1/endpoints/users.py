import logging
import time
from urllib.parse import urlsplit, urlunsplit

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.services.auth_service import get_verified_id
from app.core.constants import (
    MAX_PROFILE_IMAGE_HEIGHT,
    MAX_PROFILE_IMAGE_WIDTH,
)
from app.schemas.entities import PaperDoc, ProjectDoc, UserDoc
from app.services.storage_service import storage_service
from app.services.user_service import user_service
from app.services.projects_service import projects_service
from app.services.papers_service import papers_service
from app.utils.sorting import sort_items_latest_first

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


class UserUpdate(BaseModel):
    displayName: str | None = None
    avatarUrl: str | None = None
    username: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    preferences: dict | None = None


class DashboardResponse(BaseModel):
    user: UserDoc
    projects: list[ProjectDoc]
    papers: list[PaperDoc]


def _with_cache_buster(url: str) -> str:
    parts = urlsplit(url)
    if parts.query:
        return url
    stamp = int(time.time() * 1000)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, f"time={stamp}", ""))


@router.get("/me", response_model=UserDoc)
def get_me(userId: str = Depends(get_verified_id)) -> UserDoc:
    return user_service.get_by_id(userId)


@router.patch("/me", response_model=UserDoc)
def patch_me(
    payload: UserUpdate,
    userId: str = Depends(get_verified_id),
) -> UserDoc:
    return user_service.update_user(
        userId,
        payload.model_dump(exclude_none=True),
    )


def _delete_user_in_background(userId: str) -> None:
    try:
        user_service.delete_user(userId)
    except Exception:
        logger.exception("Background user delete failed for userId=%s", userId)


@router.delete("/me", status_code=202)
def delete_me(background_tasks: BackgroundTasks, userId: str = Depends(get_verified_id)) -> dict[str, bool]:
    user_service.get_by_id(userId)
    background_tasks.add_task(_delete_user_in_background, userId)
    return {"ok": True}


@router.post("/me/profile-image")
async def upload_profile_image(
    file: UploadFile = File(...),
    userId: str = Depends(get_verified_id),
) -> dict[str, str]:
    url = await storage_service.upload_image(
        f"users/{userId}/profile/avatar",
        file,
        max_width=MAX_PROFILE_IMAGE_WIDTH,
        max_height=MAX_PROFILE_IMAGE_HEIGHT,
        crop=True,
        overwrite_name="avatar",
    )
    url = _with_cache_buster(url)
    user_service.update_user(userId, {"avatarUrl": url})
    return {"url": url}


@router.get("/username/available")
def check_username_available(
    username: str = Query(...),
    userId: str = Depends(get_verified_id),
) -> dict[str, bool]:
    return {"available": user_service.is_username_available(username, userId)}


@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard_data(userId: str = Depends(get_verified_id)) -> DashboardResponse:
    """Get all dashboard data: user profile, projects, and standalone papers (public/draft), sorted by updatedAt."""
    user = user_service.get_by_id(userId)
    projects = projects_service.list_owned(userId)
    standalonePapers = papers_service.list_standalone(ownerId=userId)

    projects = sort_items_latest_first(projects)
    standalonePapers = sort_items_latest_first(standalonePapers)

    return DashboardResponse(
        user=user,
        projects=projects,
        papers=standalonePapers,
    )


@router.get("/{username}", response_model=UserDoc)
def get_user_by_username(
    username: str,
    _userId: str = Depends(get_verified_id),
) -> UserDoc:
    return user_service.get_by_username(username)
