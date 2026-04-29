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
def list_own_projects(userId: str = Depends(get_verified_id)) -> list[ProjectDoc]:
    return projects_service.list_owned(userId)


@router.post("/projects", response_model=ProjectDoc, status_code=201)
def create_project(
    payload: ProjectCreateRequest,
    userId: str = Depends(get_verified_id),
) -> ProjectDoc:
    return projects_service.create(userId, payload.model_dump())


@router.get("/projects/slug/available")
def check_projectSlug_available(
    slug: str = Query(...),
    projectId: str | None = Query(default=None, alias="projectId"),
    userId: str = Depends(get_verified_id),
) -> dict[str, bool]:
    return {"available": projects_service.is_slug_available(userId, slug, projectId)}


@router.get("/projects/slug/{username}/{projectSlug}", response_model=ProjectDoc)
def get_project_by_slug(username: str, projectSlug: str, userId: str = Depends(get_verified_id)) -> ProjectDoc:
    project = projects_service.get_by_slug(username, projectSlug)
    if project.get("ownerId") != userId:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return project


@router.get("/projects/{projectId}", response_model=ProjectDoc)
def get_project(projectId: str, userId: str = Depends(get_verified_id)) -> ProjectDoc:
    return require_owned_project(userId, projectId)


@router.patch("/projects/{projectId}", response_model=ProjectDoc)
def patch_project(
    projectId: str,
    payload: ProjectUpdateRequest,
    background_tasks: BackgroundTasks,
    userId: str = Depends(get_verified_id),
) -> ProjectDoc:
    require_owned_project(userId, projectId)

    update_payload = payload.model_dump(exclude_unset=True)
    clear_logo = "logoUrl" in update_payload and not update_payload["logoUrl"]

    if "logoUrl" in update_payload and update_payload["logoUrl"]:
        update_payload["logoUrl"] = add_cache_buster(update_payload["logoUrl"])
    if clear_logo:
        update_payload.pop("logoUrl", None)

    updated = projects_service.update(projectId, update_payload)
    if clear_logo:
        projects_service.delete_project_logo(projectId)
        updated = projects_service.get_by_id(projectId)

    if payload.description is not None:
        used_urls = extract_image_urls(updated.get("description") or "")
        background_tasks.add_task(
            projects_service.delete_unused_project_embedded_images,
            userId,
            projectId,
            used_urls,
        )

    return updated


@router.post("/projects/{projectId}/logo")
async def upload_project_logo(
    projectId: str,
    file: UploadFile = File(...),
    userId: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_project(userId, projectId)
    result = await projects_service.upload_logo(projectId, file)
    return {"url": result["url"]}


@router.post("/projects/{projectId}/embedded-image")
async def upload_project_embedded_image(
    projectId: str,
    file: UploadFile = File(...),
    userId: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_project(userId, projectId)
    return await projects_service.upload_embedded_image(projectId, file)


@router.patch("/projects/{projectId}/visibility", response_model=ProjectDoc)
def patch_project_visibility(
    projectId: str,
    payload: ProjectVisibilityToggleRequest,
    userId: str = Depends(get_verified_id),
) -> ProjectDoc:
    require_owned_project(userId, projectId)
    return projects_service.set_visibility(projectId, payload.isPublic)


@router.get("/projects/{projectId}/dashboard", response_model=ProjectDashboardResponse)
def get_project_dashboard(
    projectId: str,
    userId: str = Depends(get_verified_id),
) -> ProjectDashboardResponse:
    """Get project dashboard data: project, collections, and papers sorted by updatedAt."""
    project = require_owned_project(userId, projectId)

    collections = collections_service.list_project_collections(projectId)
    project_papers = papers_service.list_owned_filtered(
        ownerId=userId,
        projectId=projectId,
        standalone=True,
    )

    collections = sort_items_latest_first(collections)
    project_papers = sort_items_latest_first(project_papers)

    return ProjectDashboardResponse(
        project=project,
        collections=collections,
        papers=project_papers,
    )

@router.delete("/projects/{projectId}")
def delete_project(projectId: str, userId: str = Depends(get_verified_id)) -> dict[str, bool]:
    require_owned_project(userId, projectId)
    return projects_service.delete(projectId)
