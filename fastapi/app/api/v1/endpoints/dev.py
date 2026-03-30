import asyncio
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Path, Query, Response

from app.schemas.entities import (
    ApiKeyCreateResponse,
    ApiKeySummary,
    ApiKeyToggle,
)
from app.services.auth_service import get_verified_id
from app.services._dev_api_service import _dev_api_service
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service

router = APIRouter(prefix="/dev", tags=["dev"])
api_keys_router = APIRouter(tags=["api-keys"])
CurrentUserIdDep = Annotated[str, Depends(get_verified_id)]

XApiKey = Annotated[str | None, Header(alias="x-api-key")]


def _extract_api_key(api_key_header: str | None) -> str:
    value = (api_key_header or "").strip()
    if not value:
        raise HTTPException(status_code=401, detail="Missing x-api-key header.")
    return value


def _extract_key_project_id(key_doc: dict) -> str:
    key_project_id = str(key_doc.get("projectId") or "").strip()
    if not key_project_id:
        raise HTTPException(status_code=401, detail="API key is not linked to any project.")
    return key_project_id


def _add_usage_increment(background_tasks: BackgroundTasks, key_doc: dict) -> None:
    key_hash = key_doc.get("keyHash")
    if not key_hash:
        return
    background_tasks.add_task(
        _dev_api_service.increment_usage,
        key_hash,
    )


def _resolve_paper_for_project(project_id: str, paper_id: str | None, paper_slug: str | None) -> dict:
    if bool(paper_id) == bool(paper_slug):
        raise HTTPException(status_code=400, detail="Provide exactly one of: id or slug.")

    if paper_id:
        paper = papers_service.get_by_id(paper_id, public=True)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found for id.")
        if paper.get("projectId") != project_id:
            raise HTTPException(status_code=403, detail="Paper does not belong to the API key project.")
    else:
        paper = papers_service.get_by_project_slug(project_id=project_id, paper_slug=paper_slug or "", public=True)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found for slug in this project.")

    return paper


def _mask_owner_in_project(project: dict) -> dict:
    masked = dict(project)
    masked["ownerId"] = None
    return masked


def _mask_owner_in_collection(collection: dict) -> dict:
    masked = dict(collection)
    masked["ownerId"] = None
    return masked


def _mask_owner_in_paper(paper: dict) -> dict:
    masked = dict(paper)
    masked["ownerId"] = None
    return masked



@router.get("/project")
async def get_project_bundle(
    background_tasks: BackgroundTasks,
    response: Response,
    x_api_key: XApiKey = None,
) -> dict:
    raw_key = _extract_api_key(x_api_key)
    key_doc = _dev_api_service.validate_key(raw_key)
    project_id = _extract_key_project_id(key_doc)
    project, collections = await asyncio.gather(
        asyncio.to_thread(projects_service.get_by_id, project_id, True),
        asyncio.to_thread(collections_service.list_project_collections, project_id, True),
    )
    _add_usage_increment(background_tasks, key_doc)
    
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=300, stale-while-revalidate=300"


    return {
        "project": _mask_owner_in_project(project),
        "collections": [_mask_owner_in_collection(collection) for collection in collections],
    }


@router.get("/collection")
async def get_collection_bundle(
    background_tasks: BackgroundTasks,
    response: Response,
    collection_id: Annotated[str | None, Query(alias="id")] = None,
    collection_slug: Annotated[str | None, Query(alias="slug")] = None,
    x_api_key: XApiKey = None,
) -> dict:
    raw_key = _extract_api_key(x_api_key)
    key_doc = _dev_api_service.validate_key(raw_key)
    key_project_id = _extract_key_project_id(key_doc)
    if bool(collection_id) == bool(collection_slug):
        raise HTTPException(status_code=400, detail="Provide exactly one of: id or slug.")

    project_task = asyncio.to_thread(projects_service.get_by_id, key_project_id, True)
    if collection_id:
        collection_task = asyncio.to_thread(collections_service.get_by_id, collection_id, True)
        project, collection = await asyncio.gather(project_task, collection_task)
        if collection.get("projectId") != key_project_id:
            raise HTTPException(status_code=403, detail="Collection does not belong to the API key project.")
    else:
        collection_task = asyncio.to_thread(
            collections_service.get_by_slug,
            key_project_id,
            collection_slug or "",
            True,
        )
        project, collection = await asyncio.gather(project_task, collection_task)
        if collection.get("projectId") != project.get("projectId"):
            raise HTTPException(status_code=403, detail="Collection does not belong to the API key project.")

    _add_usage_increment(background_tasks, key_doc)
    papers = await asyncio.to_thread(papers_service.list_by_collection_id, collection.get("collectionId"), True)
    
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=300, stale-while-revalidate=300"


    return {
        "collection": _mask_owner_in_collection(collection),
        "papers": [_mask_owner_in_paper(paper) for paper in papers],
    }


@router.get("/paper")
async def get_paper(
    background_tasks: BackgroundTasks,
    response: Response,
    paper_id: Annotated[str | None, Query(alias="id")] = None,
    paper_slug: Annotated[str | None, Query(alias="slug")] = None,
    x_api_key: XApiKey = None,
) -> dict:
    raw_key = _extract_api_key(x_api_key)
    key_doc = _dev_api_service.validate_key(raw_key)
    key_project_id = _extract_key_project_id(key_doc)
    paper = await asyncio.to_thread(_resolve_paper_for_project, key_project_id, paper_id, paper_slug)
    _add_usage_increment(background_tasks, key_doc)
    
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=300, stale-while-revalidate=300"


    return {
        "paper": _mask_owner_in_paper(paper),
    }


@api_keys_router.get("/projects/{project_id}/api-key", response_model=ApiKeySummary | None)
def get_project_api_key(
    project_id: Annotated[str, Path()],
    user_id: CurrentUserIdDep,
) -> ApiKeySummary | None:
    project = projects_service.get_by_id(project_id)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return _dev_api_service.get_project_api_key(project_id, user_id)


@api_keys_router.post("/projects/{project_id}/api-key", response_model=ApiKeyCreateResponse, status_code=201)
def create_api_key(
    project_id: Annotated[str, Path()],
    user_id: CurrentUserIdDep,
) -> ApiKeyCreateResponse:
    project = projects_service.get_by_id(project_id)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return _dev_api_service.create(user_id, project_id)


@api_keys_router.patch("/api-keys/{key_id}", response_model=ApiKeySummary)
def toggle_api_key(key_id: str, payload: ApiKeyToggle, user_id: CurrentUserIdDep) -> ApiKeySummary:
    key_doc = _dev_api_service.get_by_id(key_id)
    if key_doc.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return _dev_api_service.toggle_active(key_id, payload.isActive)


@api_keys_router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: str, user_id: CurrentUserIdDep) -> dict[str, bool]:
    key_doc = _dev_api_service.get_by_id(key_id)
    if key_doc.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return _dev_api_service.delete(key_id)
