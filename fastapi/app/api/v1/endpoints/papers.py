import re
import time
from urllib.parse import urlsplit, urlunsplit

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from app.services.auth_service import get_verified_id
from app.schemas.entities import PaperCreate, PaperCreateResponse, PaperDoc, PaperUpdate
from app.services.papers_service import papers_service
from app.services.storage_service import storage_service

router = APIRouter(tags=["papers"])

MARKDOWN_IMAGE_PATTERN = re.compile(r"!\[[^\]]*]\(([^)\s]+)", re.IGNORECASE)
HTML_IMAGE_PATTERN = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)


def _normalize_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def _extract_image_urls(content: str) -> set[str]:
    urls = set()
    for match in MARKDOWN_IMAGE_PATTERN.findall(content):
        urls.add(_normalize_url(match))
    for match in HTML_IMAGE_PATTERN.findall(content):
        urls.add(_normalize_url(match))
    return urls


def _with_cache_buster(url: str) -> str:
    parts = urlsplit(url)
    if parts.query:
        return url
    stamp = int(time.time() * 1000)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, f"time={stamp}", ""))


@router.get("/papers", response_model=list[PaperDoc])
def list_own_papers(
    user_id: str = Depends(get_verified_id),
    project_id: str | None = Query(default=None, alias="projectId"),
    standalone: bool = False,
) -> list[PaperDoc]:
    return papers_service.list_owned_filtered(
        owner_id=user_id,
        project_id=project_id,
        standalone=standalone,
    )


@router.post("/papers/{paper_id}/thumbnail")
async def upload_thumbnail(
    paper_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    return await papers_service.upload_thumbnail(paper_id, user_id, file)


@router.post("/papers/{paper_id}/embedded-image")
async def upload_embedded_image(
    paper_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_id),
) -> dict[str, str]:
    return await papers_service.upload_embedded_image(paper_id, user_id, file)


@router.post("/papers", response_model=PaperCreateResponse, status_code=201)
def create_paper(payload: PaperCreate, user_id: str = Depends(get_verified_id)) -> PaperCreateResponse:
    return papers_service.create(user_id, payload.model_dump())


@router.patch("/papers/{paper_id}", response_model=PaperDoc)
def patch_paper(
    paper_id: str,
    payload: PaperUpdate,
    user_id: str = Depends(get_verified_id),
) -> PaperDoc:
    update_payload = payload.model_dump(exclude_unset=True)

    if "thumbnailUrl" in update_payload:
        if update_payload["thumbnailUrl"]:
            update_payload["thumbnailUrl"] = _with_cache_buster(update_payload["thumbnailUrl"])
    updated = papers_service.update(
        paper_id,
        user_id,
        update_payload,
    )
    if "thumbnailUrl" in update_payload and not update_payload["thumbnailUrl"]:
        storage_service.delete_thumbnail(user_id, paper_id)
    if payload.body is not None:
        used_urls = _extract_image_urls(updated.get("body") or "")
        storage_service.delete_unused_embedded_images(user_id, paper_id, used_urls)
    return updated


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
    return papers_service.delete(paper_id, user_id)
