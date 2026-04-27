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
    user_id: str = Depends(get_verified_id),
    projectId: str = Query(...),
) -> list[CollectionDoc]:
    require_owned_project(user_id, projectId)
    return collections_service.list_project_collections(projectId)


@router.get("/collections/{collection_id}", response_model=CollectionDoc)
def get_collection(
    collection_id: str,
    user_id: str = Depends(get_verified_id),
) -> CollectionDoc:
    return require_owned_collection(user_id, collection_id)


@router.get("/collections/{collection_id}/papers", response_model=list[PaperDoc])
def list_collection_papers(
    collection_id: str,
    user_id: str = Depends(get_verified_id),
) -> list[PaperDoc]:
    require_owned_collection(user_id, collection_id)
    papers = papers_service.list_by_collection_id(collection_id)
    return sort_items_latest_first(papers)


@router.get("/collections/slug/available")
def check_collection_slug_available(
    slug: str = Query(..., min_length=2, max_length=80),
    projectId: str = Query(...),
    collectionId: str | None = Query(default=None),
    user_id: str = Depends(get_verified_id),
) -> dict[str, bool]:
    require_owned_project(user_id, projectId)
    available = collections_service.is_slug_available(projectId, slug, collectionId)
    return {"available": available}


@router.post("/collections", response_model=CollectionDoc, status_code=201)
def create_collection(payload: CollectionCreateRequest, user_id: str = Depends(get_verified_id)) -> CollectionDoc:
    require_owned_project(user_id, payload.projectId)
    return collections_service.create(user_id, payload.model_dump())


@router.patch("/collections/{collection_id}", response_model=CollectionDoc)
def patch_collection(
    collection_id: str,
    payload: CollectionUpdateRequest,
    user_id: str = Depends(get_verified_id),
) -> CollectionDoc:
    require_owned_collection(user_id, collection_id)
    return collections_service.update(collection_id, payload.model_dump(exclude_unset=True))


@router.patch("/collections/{collection_id}/visibility", response_model=CollectionDoc)
def patch_collection_visibility(
    collection_id: str,
    payload: CollectionVisibilityToggleRequest,
    user_id: str = Depends(get_verified_id),
) -> CollectionDoc:
    require_owned_collection(user_id, collection_id)
    return collections_service.set_visibility(collection_id, payload.isPublic)


@router.delete("/collections/{collection_id}")
def delete_collection(collection_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
    require_owned_collection(user_id, collection_id)
    return collections_service.delete(collection_id)
