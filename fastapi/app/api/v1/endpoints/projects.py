from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.api.deps.ownership import require_owned_project
from app.services.auth_service import get_verified_id
from app.schemas.entities import CollectionDoc, PaperDoc, ProjectDoc
from app.services.projects_service import projects_service
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.utils.cache import add_cache_buster
from app.utils.content import extract_image_urls
from app.utils.sorting import sort_items_latest_first

router = APIRouter(tags=["projects"])


class ProjectCreateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    contentGuidelines: str | None = None
    logoUrl: str | None = None
    isPublic: bool = True


class ProjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    contentGuidelines: str | None = None
    logoUrl: str | None = None


class ProjectVisibilityToggleRequest(BaseModel):
    isPublic: bool


class ProjectDashboardResponse(BaseModel):
    project: ProjectDoc
    collections: list[CollectionDoc]
    papers: list[PaperDoc]


@router.get("/projects", response_model=list[ProjectDoc])
def list_own_projects(user_id: str = Depends(get_verified_id)) -> list[ProjectDoc]:
    return projects_service.list_owned(user_id)


@router.post("/projects", response_model=ProjectDoc, status_code=201)
def create_project(
    payload: ProjectCreateRequest,
    user_id: str = Depends(get_verified_id),
) -> ProjectDoc:
    return projects_service.create(user_id, payload.model_dump())


@router.get("/projects/slug/available")
def check_project_slug_available(
    slug: str = Query(...),
    project_id: str | None = Query(default=None, alias="projectId"),
    user_id: str = Depends(get_verified_id),
) -> dict[str, bool]:
    return {"available": projects_service.is_slug_available(user_id, slug, project_id)}


@router.get("/projects/slug/{username}/{project_slug}", response_model=ProjectDoc)
def get_project_by_slug(username: str, project_slug: str, user_id: str = Depends(get_verified_id)) -> ProjectDoc:
    project = projects_service.get_by_slug(username, project_slug)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return project


@router.get("/projects/{project_id}", response_model=ProjectDoc)
def get_project(project_id: str, user_id: str = Depends(get_verified_id)) -> ProjectDoc:
    return require_owned_project(user_id, project_id)


@router.patch("/projects/{project_id}", response_model=ProjectDoc)
def patch_project(
    project_id: str,
    payload: ProjectUpdateRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_verified_id),
) -> ProjectDoc:
    require_owned_project(user_id, project_id)

    update_payload = payload.model_dump(exclude_unset=True)
    clear_logo = "logoUrl" in update_payload and not update_payload["logoUrl"]

    if "logoUrl" in update_payload and update_payload["logoUrl"]:
        update_payload["logoUrl"] = add_cache_buster(update_payload["logoUrl"])
    if clear_logo:
        update_payload.pop("logoUrl", None)

    updated = projects_service.update(project_id, update_payload)
    if clear_logo:
        projects_service.delete_project_logo(project_id)
        updated = projects_service.get_by_id(project_id)

    if payload.description is not None:
        used_urls = extract_image_urls(updated.get("description") or "")
        background_tasks.add_task(
            projects_service.delete_unused_project_embedded_images,
            user_id,
            project_id,
            used_urls,
        )

    return updated


@router.post("/projects/{project_id}/logo")
async def upload_project_logo(
    project_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_project(user_id, project_id)
    result = await projects_service.upload_logo(project_id, file)
    return {"url": result["url"]}


@router.post("/projects/{project_id}/embedded-image")
async def upload_project_embedded_image(
    project_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_project(user_id, project_id)
    return await projects_service.upload_embedded_image(project_id, file)


@router.patch("/projects/{project_id}/visibility", response_model=ProjectDoc)
def patch_project_visibility(
    project_id: str,
    payload: ProjectVisibilityToggleRequest,
    user_id: str = Depends(get_verified_id),
) -> ProjectDoc:
    require_owned_project(user_id, project_id)
    return projects_service.set_visibility(project_id, payload.isPublic)


@router.get("/projects/{project_id}/dashboard", response_model=ProjectDashboardResponse)
def get_project_dashboard(
    project_id: str,
    user_id: str = Depends(get_verified_id),
) -> ProjectDashboardResponse:
    """Get project dashboard data: project, collections, and papers sorted by updatedAt."""
    project = require_owned_project(user_id, project_id)

    collections = collections_service.list_project_collections(project_id)
    project_papers = papers_service.list_owned_filtered(
        owner_id=user_id,
        project_id=project_id,
        standalone=True,
    )

    collections = sort_items_latest_first(collections)
    project_papers = sort_items_latest_first(project_papers)

    return ProjectDashboardResponse(
        project=project,
        collections=collections,
        papers=project_papers,
    )

@router.delete("/projects/{project_id}")
def delete_project(project_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
    require_owned_project(user_id, project_id)
    return projects_service.delete(project_id)
