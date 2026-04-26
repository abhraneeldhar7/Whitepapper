import re
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field

from app.services.auth_service import get_verified_id
from app.schemas.entities import PaperDoc, PaperMetadata
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.utils.cache import add_cache_buster

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

MARKDOWN_IMAGE_PATTERN = re.compile(r"!\[[^\]]*]\(([^)\s]+)", re.IGNORECASE)
HTML_IMAGE_PATTERN = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)


def _extract_image_urls(content: str) -> set[str]:
    urls = set()
    for match in MARKDOWN_IMAGE_PATTERN.findall(content):
        urls.add(match)
    for match in HTML_IMAGE_PATTERN.findall(content):
        urls.add(match)
    return urls


def _to_timestamp(value: object) -> float:
    if not value:
        return 0.0
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


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
    papers.sort(
        key=lambda paper: (
            _to_timestamp(paper.get("updatedAt")),
            _to_timestamp(paper.get("createdAt")),
        ),
        reverse=True,
    )
    return papers


@router.post("/papers/{paper_id}/thumbnail")
async def upload_thumbnail(
    paper_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return await papers_service.upload_thumbnail(paper_id, file)


@router.post("/papers/{paper_id}/embedded-image")
async def upload_embedded_image(
    paper_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return await papers_service.upload_embedded_image(paper_id, file)


@router.post("/papers/{paper_id}/metadata-image/{field}")
async def upload_metadata_image(
    paper_id: str,
    field: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return await papers_service.upload_metadata_image(paper_id, field, file)


@router.post("/papers", response_model=PaperCreateResponse, status_code=201)
def create_paper(payload: PaperCreateRequest, user_id: str = Depends(get_verified_id)) -> PaperCreateResponse:
    if payload.projectId:
        project = projects_service.get_by_id(payload.projectId)
        if project.get("ownerId") != user_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
    if payload.collectionId:
        collection = collections_service.get_by_id(payload.collectionId)
        if collection.get("ownerId") != user_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
    return papers_service.create(user_id, payload.model_dump())


@router.patch("/papers/{paper_id}", response_model=PaperDoc)
def patch_paper(
    paper_id: str,
    payload: PaperUpdateRequest,
    user_id: str = Depends(get_verified_id),
) -> PaperDoc:
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")

    update_payload = payload.model_dump(exclude_unset=True)

    if "thumbnailUrl" in update_payload:
        if update_payload["thumbnailUrl"]:
            update_payload["thumbnailUrl"] = add_cache_buster(update_payload["thumbnailUrl"])
    updated = papers_service.update(paper_id, update_payload)
    if "thumbnailUrl" in update_payload and not update_payload["thumbnailUrl"]:
        papers_service.delete_thumbnail(user_id, paper_id)
    if payload.body is not None:
        used_urls = _extract_image_urls(updated.get("body") or "")
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
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
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
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return paper


@router.delete("/papers/{paper_id}")
def delete_paper(paper_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return papers_service.delete(paper_id)
