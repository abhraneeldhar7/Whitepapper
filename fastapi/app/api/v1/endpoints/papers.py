from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.api.deps.ownership import require_owned_collection, require_owned_paper, require_owned_project
from app.services.auth_service import get_verified_id
from app.schemas.entities import PaperDoc, PaperMetadata
from app.services.papers_service import papers_service
from app.utils.cache import add_cache_buster
from app.utils.content import extract_image_urls
from app.utils.sorting import sort_items_latest_first

router = APIRouter(tags=["papers"])


class PaperCreateRequest(BaseModel):
    collectionId: str | None = None
    projectId: str | None = None
    thumbnailUrl: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=2, max_length=120)
    body: str = ""
    status: Literal["draft", "published", "archived"] = "draft"


class PaperUpdateRequest(BaseModel):
    collectionId: str | None = None
    projectId: str | None = None
    thumbnailUrl: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    slug: str | None = Field(default=None, min_length=2, max_length=120)
    body: str | None = None
    status: Literal["draft", "published", "archived"] | None = None
    metadata: PaperMetadata | None = None


class PaperCreateResponse(BaseModel):
    paperId: str


class PaperMetadataGenerateRequest(BaseModel):
    payload: PaperDoc

@router.get("/papers", response_model=list[PaperDoc])
def list_own_papers(
    userId: str = Depends(get_verified_id),
    projectId: str | None = Query(default=None, alias="projectId"),
    standalone: bool = False,
) -> list[PaperDoc]:
    papers = papers_service.list_owned_filtered(
        ownerId=userId,
        projectId=projectId,
        standalone=standalone,
    )
    return sort_items_latest_first(papers)


@router.post("/papers/{paperId}/thumbnail")
async def upload_thumbnail(
    paperId: str,
    file: UploadFile = File(...),
    userId: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_paper(userId, paperId)
    return await papers_service.upload_thumbnail(paperId, file)


@router.post("/papers/{paperId}/embedded-image")
async def upload_embedded_image(
    paperId: str,
    file: UploadFile = File(...),
    userId: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_paper(userId, paperId)
    return await papers_service.upload_embedded_image(paperId, file)


@router.post("/papers/{paperId}/metadata-image/{field}")
async def upload_metadata_image(
    paperId: str,
    field: str,
    file: UploadFile = File(...),
    userId: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_paper(userId, paperId)
    return await papers_service.upload_metadata_image(paperId, field, file)


@router.post("/papers", response_model=PaperCreateResponse, status_code=201)
def create_paper(payload: PaperCreateRequest, userId: str = Depends(get_verified_id)) -> PaperCreateResponse:
    if payload.projectId:
        require_owned_project(userId, payload.projectId)
    if payload.collectionId:
        require_owned_collection(userId, payload.collectionId)
    return papers_service.create(userId, payload.model_dump())


@router.patch("/papers/{paperId}", response_model=PaperDoc)
def patch_paper(
    paperId: str,
    payload: PaperUpdateRequest,
    userId: str = Depends(get_verified_id),
) -> PaperDoc:
    require_owned_paper(userId, paperId)

    update_payload = payload.model_dump(exclude_unset=True)

    if "thumbnailUrl" in update_payload:
        if update_payload["thumbnailUrl"]:
            update_payload["thumbnailUrl"] = add_cache_buster(update_payload["thumbnailUrl"])
    updated = papers_service.update(paperId, update_payload)
    if "thumbnailUrl" in update_payload and not update_payload["thumbnailUrl"]:
        papers_service.delete_thumbnail(userId, paperId)
    if payload.body is not None:
        used_urls = extract_image_urls(updated.get("body") or "")
        papers_service.delete_unused_embedded_images(userId, paperId, used_urls)
    metadata_urls = papers_service.extract_metadata_image_urls(updated.get("metadata"))
    papers_service.delete_unused_metadata_images(userId, paperId, metadata_urls)
    return updated


@router.post("/papers/{paperId}/metadata/preview", response_model=PaperMetadata)
def preview_paper_metadata(
    paperId: str,
    payload: PaperMetadataGenerateRequest,
    userId: str = Depends(get_verified_id),
) -> PaperMetadata:
    require_owned_paper(userId, paperId)
    generated_payload = payload.payload.model_dump(mode="json")
    if generated_payload.get("ownerId") != userId:
        raise HTTPException(status_code=403, detail="Not allowed.")
    if str(generated_payload.get("paperId") or "").strip() != paperId:
        raise HTTPException(status_code=400, detail="paperId does not match the payload paper.")
    return papers_service.preview_metadata(generated_payload)


@router.get("/papers/slug/available")
def check_slug_available(
    slug: str = Query(...),
    paperId: str | None = Query(default=None, alias="paperId"),
    userId: str = Depends(get_verified_id),
) -> dict[str, bool]:
    return {"available": papers_service.is_slug_available(userId, slug, paperId)}


@router.get("/papers/{paperId}", response_model=PaperDoc)
def get_own_paper(
    paperId: str,
    userId: str = Depends(get_verified_id),
) -> PaperDoc:
    return require_owned_paper(userId, paperId)


@router.delete("/papers/{paperId}")
def delete_paper(paperId: str, userId: str = Depends(get_verified_id)) -> dict[str, bool]:
    require_owned_paper(userId, paperId)
    return papers_service.delete(paperId)
