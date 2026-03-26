from fastapi import APIRouter, Depends, HTTPException, Query

from app.services.auth_service import get_verified_id
from app.schemas.entities import CollectionCreate, CollectionDoc, CollectionUpdate, CollectionVisibilityToggle
from app.services.collections_service import collections_service
from app.services.projects_service import projects_service

router = APIRouter(tags=["collections"])


@router.get("/collections", response_model=list[CollectionDoc])
def list_project_collections(
    user_id: str = Depends(get_verified_id),
    projectId: str = Query(...),
) -> list[CollectionDoc]:
    project = projects_service.get_by_id(projectId)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return collections_service.list_project_collections(projectId)


@router.get("/collections/{collection_id}", response_model=CollectionDoc)
def get_collection(
    collection_id: str,
    user_id: str = Depends(get_verified_id),
) -> CollectionDoc:
    return collections_service.get_by_id(collection_id, user_id)


@router.get("/collections/slug/available")
def check_collection_slug_available(
    slug: str = Query(..., min_length=2, max_length=80),
    projectId: str = Query(...),
    collectionId: str | None = Query(default=None),
    user_id: str = Depends(get_verified_id),
) -> dict[str, bool]:
    project = projects_service.get_by_id(projectId)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    available = collections_service.is_slug_available(projectId, slug, collectionId)
    return {"available": available}


@router.post("/collections", response_model=CollectionDoc, status_code=201)
def create_collection(payload: CollectionCreate, user_id: str = Depends(get_verified_id)) -> CollectionDoc:
    return collections_service.create(user_id, payload.model_dump())


@router.patch("/collections/{collection_id}", response_model=CollectionDoc)
def patch_collection(
    collection_id: str,
    payload: CollectionUpdate,
    user_id: str = Depends(get_verified_id),
) -> CollectionDoc:
    return collections_service.update(
        collection_id,
        user_id,
        payload.model_dump(exclude_unset=True),
    )


@router.patch("/collections/{collection_id}/visibility", response_model=CollectionDoc)
def patch_collection_visibility(
    collection_id: str,
    payload: CollectionVisibilityToggle,
    user_id: str = Depends(get_verified_id),
) -> CollectionDoc:
    return collections_service.set_visibility(collection_id, user_id, payload.isPublic)


@router.delete("/collections/{collection_id}")
def delete_collection(collection_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
    return collections_service.delete(collection_id, user_id)
