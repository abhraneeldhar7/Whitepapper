from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Path, Query

from app.schemas.entities import (
    ApiKeyCreateResponse,
    ApiKeySummary,
    ApiKeyToggle,
    DevCollectionPayload,
    DevPaperPayload,
    DevProjectPayload,
)
from app.services.auth_service import get_verified_id
from app.services._dev_api_service import _dev_api_service
from app.services.collections_service import collections_service
from app.core.firestore_store import firestore_store
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug

router = APIRouter(prefix="/dev", tags=["dev"])
api_keys_router = APIRouter(tags=["api-keys"])
CurrentUserIdDep = Annotated[str, Depends(get_verified_id)]

XApiKey = Annotated[str | None, Header(alias="x-api-key")]


def _extract_api_key(api_key_header: str | None) -> str:
    value = (api_key_header or "").strip()
    if not value:
        raise HTTPException(status_code=401, detail="Missing x-api-key header.")
    return value


def _load_authorized_project(key_doc: dict) -> dict:
    key_project_id = str(key_doc.get("projectId"))
    if not key_project_id:
        raise HTTPException(status_code=401, detail="API key is not linked to any project.")

    project = projects_service.get_by_id(key_project_id)
    if not bool(project.get("isPublic")):
        raise HTTPException(status_code=403, detail="Requested project is not public.")
    return project


def _add_usage_increment(background_tasks: BackgroundTasks, key_doc: dict) -> None:
    key_id = key_doc.get("keyId")
    if not key_id:
        return
    background_tasks.add_task(
        _dev_api_service.increment_usage,
        key_id,
    )


def _resolve_paper_for_project(project_id: str, paper_id: str | None, paper_slug: str | None) -> dict:
    if bool(paper_id) == bool(paper_slug):
        raise HTTPException(status_code=400, detail="Provide exactly one of: id or slug.")

    if paper_id:
        paper = firestore_store.get("papers", paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found for id.")
    else:
        normalized_slug = normalize_slug(paper_slug or "")
        matches = firestore_store.find_by_fields(
            "papers",
            {"projectId": project_id, "slug": normalized_slug},
        )
        paper = matches[0] if matches else None
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found for slug in this project.")

    if paper.get("projectId") != project_id:
        raise HTTPException(status_code=403, detail="Paper does not belong to the API key project.")

    if paper.get("status") != "published":
        raise HTTPException(status_code=403, detail="Requested paper is not public (status must be published).")

    return paper


@router.get("/project", response_model=DevProjectPayload)
def get_project_bundle(
    background_tasks: BackgroundTasks,
    x_api_key: XApiKey = None,
) -> DevProjectPayload:
    raw_key = _extract_api_key(x_api_key)
    key_doc = _dev_api_service.validate_key(raw_key)
    project = _load_authorized_project(key_doc)
    _add_usage_increment(background_tasks, key_doc)
    project_id = project["projectId"]

    collections = [
        item
        for item in collections_service.list_project_collections(project_id)
        if bool(item.get("isPublic"))
    ]
    papers = [
        item
        for item in firestore_store.find_by_fields("papers", {"projectId": project_id})
        if item.get("status") == "published" and not item.get("collectionId")
    ]

    return {
        "project": project,
        "collections": collections,
        "papers": papers,
    }


@router.get("/collection", response_model=DevCollectionPayload)
def get_collection_bundle(
    background_tasks: BackgroundTasks,
    collection_id: Annotated[str | None, Query(alias="id")] = None,
    collection_slug: Annotated[str | None, Query(alias="slug")] = None,
    x_api_key: XApiKey = None,
) -> DevCollectionPayload:
    raw_key = _extract_api_key(x_api_key)
    key_doc = _dev_api_service.validate_key(raw_key)
    project = _load_authorized_project(key_doc)
    key_project_id = project["projectId"]
    if bool(collection_id) == bool(collection_slug):
        raise HTTPException(status_code=400, detail="Provide exactly one of: id or slug.")

    if collection_id:
        collection = firestore_store.get("collections", collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found for id.")
        if collection.get("projectId") != key_project_id:
            raise HTTPException(status_code=403, detail="Collection does not belong to the API key project.")
    else:
        normalized_slug = normalize_slug(collection_slug or "")
        collection = collections_service.get_by_slug(
            owner_id=project.get("ownerId"),
            project_id=key_project_id,
            collection_slug=normalized_slug,
        )

    if not bool(collection.get("isPublic")):
        raise HTTPException(status_code=403, detail="Requested collection is not public.")

    _add_usage_increment(background_tasks, key_doc)

    papers = [
        item
        for item in firestore_store.find_by_fields("papers", {"collectionId": collection.get("collectionId")})
        if item.get("status") == "published"
    ]

    return {
        "collection": collection,
        "papers": papers,
    }


@router.get("/paper", response_model=DevPaperPayload)
def get_paper(
    background_tasks: BackgroundTasks,
    paper_id: Annotated[str | None, Query(alias="id")] = None,
    paper_slug: Annotated[str | None, Query(alias="slug")] = None,
    x_api_key: XApiKey = None,
) -> DevPaperPayload:
    raw_key = _extract_api_key(x_api_key)
    key_doc = _dev_api_service.validate_key(raw_key)
    authorized_project = _load_authorized_project(key_doc)
    key_project_id = authorized_project["projectId"]
    paper = _resolve_paper_for_project(key_project_id, paper_id, paper_slug)
    _add_usage_increment(background_tasks, key_doc)

    matched_project = None
    matched_collection = None

    paper_project_id = str(paper.get("projectId") or "")
    if paper_project_id:
        project = firestore_store.get("projects", paper_project_id)
        if project and bool(project.get("isPublic")):
            matched_project = project

    collection_id = str(paper.get("collectionId") or "")
    if collection_id:
        collection = firestore_store.get("collections", collection_id)
        if collection and bool(collection.get("isPublic")):
            matched_collection = collection

    return {
        "paper": paper,
        "project": matched_project,
        "collection": matched_collection,
    }


@api_keys_router.get("/projects/{project_id}/api-key", response_model=ApiKeySummary | None)
async def get_project_api_key(
    project_id: Annotated[str, Path()],
    user_id: CurrentUserIdDep,
) -> ApiKeySummary | None:
    project = projects_service.get_by_id(project_id)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    matches = firestore_store.find_by_fields("apiKeys", {"projectId": project_id, "ownerId": user_id})
    key_doc = matches[0] if matches else None
    if not key_doc:
        return None
    return {key: value for key, value in key_doc.items() if key != "keyHash"}


@api_keys_router.post("/projects/{project_id}/api-key", response_model=ApiKeyCreateResponse, status_code=201)
async def create_api_key(
    project_id: Annotated[str, Path()],
    user_id: CurrentUserIdDep,
) -> ApiKeyCreateResponse:
    project = projects_service.get_by_id(project_id)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return _dev_api_service.create(user_id, project_id)


@api_keys_router.patch("/api-keys/{key_id}", response_model=ApiKeySummary)
async def toggle_api_key(key_id: str, payload: ApiKeyToggle, user_id: CurrentUserIdDep) -> ApiKeySummary:
    return _dev_api_service.toggle_active(key_id, user_id, payload.isActive)


@api_keys_router.delete("/api-keys/{key_id}")
async def delete_api_key(key_id: str, user_id: CurrentUserIdDep) -> dict[str, bool]:
    return _dev_api_service.delete(key_id, user_id)
