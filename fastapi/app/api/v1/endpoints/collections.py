from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.api.deps.ownership import require_owned_collection, require_owned_project
from app.services.auth_service import get_verified_id
from app.schemas.entities import CollectionDoc, PaperDoc
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.utils.sorting import sort_items_latest_first

router = APIRouter(tags=["collections"])


class CollectionCreateRequest(BaseModel):
    projectId: str
    name: str = Field(min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    isPublic: bool | None = None


class CollectionUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = Field(default=None, min_length=1, max_length=120)
    slug: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None


class CollectionVisibilityToggleRequest(BaseModel):
    isPublic: bool
@router.get("/collections", response_model=list[CollectionDoc])
def list_project_collections(
    userId: str = Depends(get_verified_id),
    projectId: str = Query(...),
) -> list[CollectionDoc]:
    require_owned_project(userId, projectId)
    return collections_service.list_project_collections(projectId)


@router.get("/collections/{collectionId}", response_model=CollectionDoc)
def get_collection(
    collectionId: str,
    userId: str = Depends(get_verified_id),
) -> CollectionDoc:
    return require_owned_collection(userId, collectionId)


@router.get("/collections/{collectionId}/papers", response_model=list[PaperDoc])
def list_collection_papers(
    collectionId: str,
    userId: str = Depends(get_verified_id),
) -> list[PaperDoc]:
    require_owned_collection(userId, collectionId)
    papers = papers_service.list_by_collectionId(collectionId)
    return sort_items_latest_first(papers)


@router.get("/collections/slug/available")
def check_collection_slug_available(
    slug: str = Query(..., min_length=2, max_length=80),
    projectId: str = Query(...),
    collectionId: str | None = Query(default=None),
    userId: str = Depends(get_verified_id),
) -> dict[str, bool]:
    require_owned_project(userId, projectId)
    available = collections_service.is_slug_available(projectId, slug, collectionId)
    return {"available": available}


@router.post("/collections", response_model=CollectionDoc, status_code=201)
def create_collection(payload: CollectionCreateRequest, userId: str = Depends(get_verified_id)) -> CollectionDoc:
    require_owned_project(userId, payload.projectId)
    return collections_service.create(userId, payload.model_dump())


@router.patch("/collections/{collectionId}", response_model=CollectionDoc)
def patch_collection(
    collectionId: str,
    payload: CollectionUpdateRequest,
    userId: str = Depends(get_verified_id),
) -> CollectionDoc:
    require_owned_collection(userId, collectionId)
    return collections_service.update(collectionId, payload.model_dump(exclude_unset=True))


@router.patch("/collections/{collectionId}/visibility", response_model=CollectionDoc)
def patch_collection_visibility(
    collectionId: str,
    payload: CollectionVisibilityToggleRequest,
    userId: str = Depends(get_verified_id),
) -> CollectionDoc:
    require_owned_collection(userId, collectionId)
    return collections_service.set_visibility(collectionId, payload.isPublic)


@router.delete("/collections/{collectionId}")
def delete_collection(collectionId: str, userId: str = Depends(get_verified_id)) -> dict[str, bool]:
    require_owned_collection(userId, collectionId)
    return collections_service.delete(collectionId)
