from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings
from app.schemas.entities import DistributionPublishInput, PaperDoc
from app.services.papers_service import papers_service
from app.services.slug_utils import normalize_slug
from app.services.user_service import user_service


def build_public_article_url(username: str, slug: str) -> str:
    settings = get_settings()
    base_url = str(settings.public_site_url or "").strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=500, detail="PUBLIC_SITE_URL is not configured.")
    return f"{base_url}/{username}/{slug}"


def extract_tags(metadata: Any) -> list[str]:
    if not metadata:
        return []

    raw_tags = metadata.get("ogTags") if isinstance(metadata, dict) else getattr(metadata, "ogTags", None)
    if not isinstance(raw_tags, list):
        return []

    return [str(tag).strip() for tag in raw_tags if str(tag).strip()]


def extract_description(metadata: Any) -> str:
    if not metadata:
        return ""

    for key in ("metaDescription", "abstract", "ogDescription", "twitterDescription"):
        value = metadata.get(key) if isinstance(metadata, dict) else getattr(metadata, key, None)
        resolved = str(value or "").strip()
        if resolved:
            return resolved
    return ""


def require_owned_paper(user_id: str, paper_id: str) -> dict[str, Any]:
    paper_doc = papers_service.get_by_id(paper_id)
    if not paper_doc:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper_doc.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to distribute this paper.")
    return paper_doc


def resolve_distribution_access_token(platform: str, user_id: str, provided_access_token: str | None) -> str:
    from app.services.distributions import distributions_store_service

    candidate = str(provided_access_token or "").strip()
    if candidate:
        return candidate

    token = (
        distributions_store_service.get_hashnode_access_token(user_id)
        if platform == "hashnode"
        else distributions_store_service.get_devto_access_token(user_id)
    )
    if token:
        return token

    platform_label = "Hashnode" if platform == "hashnode" else "Dev.to"
    raise HTTPException(
        status_code=400,
        detail=f"{platform_label} access token not found. Add it in Integrations or keep it in local storage.",
    )


def resolve_publish_paper(user_id: str, input_payload: DistributionPublishInput) -> dict[str, Any]:
    if input_payload.payload is not None:
        payload_paper = input_payload.payload.model_dump(mode="json") if isinstance(input_payload.payload, PaperDoc) else {}
        if payload_paper.get("ownerId") != user_id:
            raise HTTPException(status_code=403, detail="You do not have access to distribute this paper.")
        if str(payload_paper.get("paperId") or "").strip() != input_payload.paperId:
            raise HTTPException(status_code=400, detail="paperId does not match the payload paper.")
        return payload_paper

    return require_owned_paper(user_id, input_payload.paperId)


def resolve_publish_content(paper_doc: dict[str, Any]) -> tuple[str, str, str, dict[str, Any]]:
    metadata = paper_doc.get("metadata") if isinstance(paper_doc.get("metadata"), dict) else {}
    title = str(paper_doc.get("title") or "").strip()
    body = str(paper_doc.get("body") or "").strip()
    slug = normalize_slug(str(paper_doc.get("slug") or title).strip())

    if not title:
        raise HTTPException(status_code=400, detail="Paper title is required before distributing.")
    if not body:
        raise HTTPException(status_code=400, detail="Paper body is required before distributing.")
    if not slug:
        raise HTTPException(status_code=400, detail="Paper slug is required before distributing.")

    return title, body, slug, metadata


def resolve_distribution_context(user_id: str, input_payload: DistributionPublishInput) -> tuple[dict[str, Any], str, str, str, dict[str, Any], str]:
    paper_doc = resolve_publish_paper(user_id, input_payload)
    title, body, slug, metadata = resolve_publish_content(paper_doc)
    user_doc = user_service.get_by_id(user_id)
    username = str(user_doc.get("username") or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="User handle is missing.")
    return paper_doc, title, body, slug, metadata, username
