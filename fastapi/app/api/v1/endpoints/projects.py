from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
import re
import time
from urllib.parse import urlsplit, urlunsplit

from app.services.auth_service import get_verified_id
from app.schemas.entities import ProjectCreate, ProjectDoc as Project, ProjectUpdate, ProjectVisibilityToggle, ProjectDashboardPayload
from app.services.projects_service import projects_service
from app.services.storage_service import storage_service
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service

router = APIRouter(tags=["projects"])

MARKDOWN_IMAGE_PATTERN = re.compile(r"!\[[^\]]*]\(([^)\s]+)", re.IGNORECASE)
HTML_IMAGE_PATTERN = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)


def _normalize_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def _extract_image_urls(content: str) -> set[str]:
    urls = set()
    for match in MARKDOWN_IMAGE_PATTERN.findall(content):
        urls.add(_normalize_url(match))
    for match in HTML_IMAGE_PATTERN.findall(content):
        urls.add(_normalize_url(match))
    return urls


def _with_cache_buster(url: str) -> str:
    parts = urlsplit(url)
    if parts.query:
        return url
    stamp = int(time.time() * 1000)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, f"time={stamp}", ""))


@router.get("/projects", response_model=list[Project])
def list_own_projects(user_id: str = Depends(get_verified_id)) -> list[Project]:
    return projects_service.list_owned(user_id)


@router.post("/projects", response_model=Project, status_code=201)
def create_project(
    payload: ProjectCreate,
    user_id: str = Depends(get_verified_id),
) -> Project:
    return projects_service.create(user_id, payload.model_dump())


@router.get("/projects/slug/available")
def check_project_slug_available(
    slug: str = Query(...),
    project_id: str | None = Query(default=None, alias="projectId"),
    user_id: str = Depends(get_verified_id),
) -> dict[str, bool]:
    return {"available": projects_service.is_slug_available(user_id, slug, project_id)}


@router.get("/projects/slug/{project_slug}", response_model=Project)
def get_project_by_slug(project_slug: str, user_id: str = Depends(get_verified_id)) -> Project:
    return projects_service.get_by_slug(user_id, project_slug)


@router.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: str, user_id: str = Depends(get_verified_id)) -> Project:
    project = projects_service.get_by_id(project_id)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return project


@router.patch("/projects/{project_id}", response_model=Project)
def patch_project(
    project_id: str,
    payload: ProjectUpdate,
    user_id: str = Depends(get_verified_id),
) -> Project:
    update_payload = payload.model_dump(exclude_unset=True)

    if "logoUrl" in update_payload and update_payload["logoUrl"]:
        update_payload["logoUrl"] = _with_cache_buster(update_payload["logoUrl"])

    updated = projects_service.update(
        project_id,
        user_id,
        update_payload,
    )
    if "logoUrl" in update_payload and not update_payload["logoUrl"]:
        storage_service.delete_project_logo(user_id, project_id)

    if payload.description is not None:
        used_urls = _extract_image_urls(updated.get("description") or "")
        storage_service.delete_unused_project_embedded_images(user_id, project_id, used_urls)

    return updated


@router.post("/projects/{project_id}/logo")
async def upload_project_logo(
    project_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    result = await projects_service.upload_logo(project_id, user_id, file)
    return {"url": _with_cache_buster(result["url"])}


@router.post("/projects/{project_id}/embedded-image")
async def upload_project_embedded_image(
    project_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    return await projects_service.upload_embedded_image(project_id, user_id, file)


@router.patch("/projects/{project_id}/visibility", response_model=Project)
def patch_project_visibility(
    project_id: str,
    payload: ProjectVisibilityToggle,
    user_id: str = Depends(get_verified_id),
) -> Project:
    return projects_service.set_visibility(project_id, user_id, payload.isPublic)


@router.get("/projects/{project_id}/dashboard", response_model=ProjectDashboardPayload)
def get_project_dashboard(
    project_id: str,
    user_id: str = Depends(get_verified_id),
) -> ProjectDashboardPayload:
    """Get project dashboard data: project, collections, and papers sorted by updatedAt."""
    project = projects_service.get_by_id(project_id)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")

    collections = collections_service.list_project_collections(project_id)
    project_papers = papers_service.list_owned_filtered(
        owner_id=user_id,
        project_id=project_id,
        standalone=True,
    )

    # Sort by updatedAt in descending order
    collections.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    project_papers.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)

    return ProjectDashboardPayload(
        project=project,
        collections=collections,
        papers=project_papers,
    )

@router.delete("/projects/{project_id}")
def delete_project(project_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
    return projects_service.delete(project_id, user_id)
