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
    user_id: str = Depends(get_verified_id),
    project_id: str | None = Query(default=None, alias="projectId"),
    standalone: bool = False,
) -> list[PaperDoc]:
    papers = papers_service.list_owned_filtered(
        owner_id=user_id,
        project_id=project_id,
        standalone=standalone,
    )
    return sort_items_latest_first(papers)


@router.post("/papers/{paper_id}/thumbnail")
async def upload_thumbnail(
    paper_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_paper(user_id, paper_id)
    return await papers_service.upload_thumbnail(paper_id, file)


@router.post("/papers/{paper_id}/embedded-image")
async def upload_embedded_image(
    paper_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_paper(user_id, paper_id)
    return await papers_service.upload_embedded_image(paper_id, file)


@router.post("/papers/{paper_id}/metadata-image/{field}")
async def upload_metadata_image(
    paper_id: str,
    field: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    require_owned_paper(user_id, paper_id)
    return await papers_service.upload_metadata_image(paper_id, field, file)


@router.post("/papers", response_model=PaperCreateResponse, status_code=201)
def create_paper(payload: PaperCreateRequest, user_id: str = Depends(get_verified_id)) -> PaperCreateResponse:
    if payload.projectId:
        require_owned_project(user_id, payload.projectId)
    if payload.collectionId:
        require_owned_collection(user_id, payload.collectionId)
    return papers_service.create(user_id, payload.model_dump())


@router.patch("/papers/{paper_id}", response_model=PaperDoc)
def patch_paper(
    paper_id: str,
    payload: PaperUpdateRequest,
    user_id: str = Depends(get_verified_id),
) -> PaperDoc:
    require_owned_paper(user_id, paper_id)

    update_payload = payload.model_dump(exclude_unset=True)

    if "thumbnailUrl" in update_payload:
        if update_payload["thumbnailUrl"]:
            update_payload["thumbnailUrl"] = add_cache_buster(update_payload["thumbnailUrl"])
    updated = papers_service.update(paper_id, update_payload)
    if "thumbnailUrl" in update_payload and not update_payload["thumbnailUrl"]:
        papers_service.delete_thumbnail(user_id, paper_id)
    if payload.body is not None:
        used_urls = extract_image_urls(updated.get("body") or "")
        papers_service.delete_unused_embedded_images(user_id, paper_id, used_urls)
    metadata_urls = papers_service.extract_metadata_image_urls(updated.get("metadata"))
    papers_service.delete_unused_metadata_images(user_id, paper_id, metadata_urls)
    return updated


@router.post("/papers/{paper_id}/metadata/generate", response_model=PaperMetadata)
def generate_paper_metadata(
    paper_id: str,
    payload: PaperMetadataGenerateRequest,
    user_id: str = Depends(get_verified_id),
) -> PaperMetadata:
    require_owned_paper(user_id, paper_id)
    generated_payload = payload.payload.model_dump(mode="json")
    if generated_payload.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    if str(generated_payload.get("paperId") or "").strip() != paper_id:
        raise HTTPException(status_code=400, detail="paperId does not match the payload paper.")
    return papers_service.generate_metadata_preview(generated_payload)


@router.get("/papers/slug/available")
def check_slug_available(
    slug: str = Query(...),
    paper_id: str | None = Query(default=None, alias="paperId"),
    user_id: str = Depends(get_verified_id),
) -> dict[str, bool]:
    return {"available": papers_service.is_slug_available(user_id, slug, paper_id)}


@router.get("/papers/{paper_id}", response_model=PaperDoc)
def get_own_paper(
    paper_id: str,
    user_id: str = Depends(get_verified_id),
) -> PaperDoc:
    return require_owned_paper(user_id, paper_id)


@router.delete("/papers/{paper_id}")
def delete_paper(paper_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
    require_owned_paper(user_id, paper_id)
    return papers_service.delete(paper_id)
