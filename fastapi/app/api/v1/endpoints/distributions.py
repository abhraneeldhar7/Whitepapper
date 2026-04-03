from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.config import get_settings
from app.schemas.entities import (
    DistributionPublishInput,
    DistributionPublishResult,
    DevtoDistribution,
    DevtoDistributionUpsert,
    HashnodeDistribution,
    HashnodeDistributionUpsert,
)
from app.schemas.users import UserProfile
from app.services.auth_service import get_verified_id
from app.services.distributions_service import distributions_service
from app.services.papers_service import papers_service
from app.services.slug_utils import normalize_slug
from app.services.user_service import user_service

router = APIRouter(prefix="/distributions", tags=["distributions"])


def _build_public_article_url(username: str, slug: str) -> str:
    settings = get_settings()
    environment = str(settings.environment or "").strip().lower()
    if environment.startswith("dev"):
        base_url = str(settings.production_base_url or "").strip().rstrip("/")
    else:
        base_url = str(settings.public_site_url or settings.production_base_url or "").strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=500, detail="PUBLIC_SITE_URL/PRODUCTION_BASE_URL is not configured.")
    return f"{base_url}/{username}/{slug}"


def _extract_tags(metadata: Any) -> list[str]:
    if not metadata:
        return []

    raw_tags = metadata.get("ogTags") if isinstance(metadata, dict) else getattr(metadata, "ogTags", None)
    if not isinstance(raw_tags, list):
        return []

    seen: set[str] = set()
    tags: list[str] = []
    for raw_tag in raw_tags:
        label = str(raw_tag or "").strip()
        normalized = normalize_slug(label)
        if not label or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        tags.append(label)
    return tags


def _extract_description(metadata: Any) -> str:
    if not metadata:
        return ""

    for key in ("metaDescription", "abstract", "ogDescription", "twitterDescription"):
        value = metadata.get(key) if isinstance(metadata, dict) else getattr(metadata, key, None)
        resolved = str(value or "").strip()
        if resolved:
            return resolved
    return ""


def _extract_thumbnail_url(payload: DistributionPublishInput, paper_doc: dict[str, Any] | None = None) -> str | None:
    explicit_thumbnail = str(payload.thumbnailUrl or "").strip()
    if explicit_thumbnail:
        return explicit_thumbnail

    if isinstance(paper_doc, dict):
        paper_thumbnail = str(paper_doc.get("thumbnailUrl") or "").strip()
        if paper_thumbnail:
            return paper_thumbnail

    metadata = payload.metadata
    metadata_candidates: list[Any] = [metadata]
    if isinstance(paper_doc, dict):
        metadata_candidates.append(paper_doc.get("metadata"))

    for metadata_candidate in metadata_candidates:
        if not metadata_candidate:
            continue
        for key in ("coverImageUrl", "ogImage", "twitterImage"):
            value = metadata_candidate.get(key) if isinstance(metadata_candidate, dict) else getattr(metadata_candidate, key, None)
            resolved = str(value or "").strip()
            if resolved:
                return resolved
    return None


def _require_owned_paper(user_id: str, payload: DistributionPublishInput) -> dict[str, Any]:
    paper_doc = papers_service.get_by_id(payload.paperId)
    if not paper_doc:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper_doc.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="You do not have access to distribute this paper.")
    return paper_doc


def _resolve_distribution_access_token(platform: str, user_id: str, provided_access_token: str | None) -> str:
    candidate = str(provided_access_token or "").strip()
    if candidate:
        return candidate

    token = (
        distributions_service.get_hashnode_access_token(user_id)
        if platform == "hashnode"
        else distributions_service.get_devto_access_token(user_id)
    )
    if token:
        return token

    platform_label = "Hashnode" if platform == "hashnode" else "Dev.to"
    raise HTTPException(
        status_code=400,
        detail=f"{platform_label} access token not found. Add it in Integrations or keep it in local storage.",
    )


@router.get("/hashnode", response_model=HashnodeDistribution | None)
def get_hashnode_distribution(user_id: str = Depends(get_verified_id)) -> HashnodeDistribution | None:
    distribution = distributions_service.get_by_user_id(user_id)
    hashnode = distribution.get("hashnode")
    return hashnode if isinstance(hashnode, dict) else None


@router.put("/hashnode", response_model=UserProfile)
def put_hashnode_distribution(
    payload: HashnodeDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    if payload.storeInCloud:
        distributions_service.upsert_hashnode_access_token(user_id, payload.accessToken)
    else:
        # If browser storage is chosen, clear only the cloud token and preserve cached metadata.
        distributions_service.clear_hashnode_access_token(user_id)

    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "hashnodeIntegrated": True,
                "hashnodeStoreInCloud": payload.storeInCloud,
            }
        },
    )


@router.delete("/hashnode", response_model=UserProfile)
def revoke_hashnode_distribution(user_id: str = Depends(get_verified_id)) -> UserProfile:
    distributions_service.remove_hashnode_distribution(user_id)
    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "hashnodeIntegrated": False,
                "hashnodeStoreInCloud": False,
            }
        },
    )


@router.post("/hashnode/publish", response_model=DistributionPublishResult)
def publish_hashnode_distribution(
    payload: DistributionPublishInput,
    user_id: str = Depends(get_verified_id),
) -> DistributionPublishResult:
    paper_doc = _require_owned_paper(user_id, payload)
    user_doc = user_service.get_by_id(user_id)
    username = str(user_doc.get("username") or "").strip()
    slug = normalize_slug(payload.slug)
    title = payload.title.strip()
    body = payload.body.strip()

    if not username:
        raise HTTPException(status_code=400, detail="User handle is missing.")
    if not slug:
        raise HTTPException(status_code=400, detail="Paper slug is required before distributing.")
    if not title:
        raise HTTPException(status_code=400, detail="Paper title is required before distributing.")
    if not body:
        raise HTTPException(status_code=400, detail="Paper body is required before distributing.")

    access_token = _resolve_distribution_access_token("hashnode", user_id, payload.accessToken)
    thumbnail_url = _extract_thumbnail_url(payload, paper_doc)
    publication_id = distributions_service.get_hashnode_publication_id(user_id)
    if not publication_id:
        publication_id = distributions_service.fetch_hashnode_publication_id(access_token)
        distributions_service.set_hashnode_publication_id(user_id, publication_id)

    article_url = _build_public_article_url(username, slug)
    hashnode_tags = [
        {
            "slug": normalize_slug(tag),
            "name": tag,
        }
        for tag in _extract_tags(payload.metadata)
    ]

    post = distributions_service.publish_hashnode_post(
        access_token,
        {
            "title": title,
            "publicationId": publication_id,
            "contentMarkdown": payload.body,
            "slug": slug,
            "settings": {
                "enableTableOfContent": False,
            },
            "originalArticleURL": article_url,
            **({"tags": hashnode_tags} if hashnode_tags else {}),
            **({"coverImageOptions": {"coverImageURL": thumbnail_url}} if thumbnail_url else {}),
        },
    )
    return DistributionPublishResult(
        platform="hashnode",
        postId=str(post.get("id")),
        url=str(post.get("url") or article_url),
    )


@router.get("/devto", response_model=DevtoDistribution | None)
def get_devto_distribution(user_id: str = Depends(get_verified_id)) -> DevtoDistribution | None:
    distribution = distributions_service.get_by_user_id(user_id)
    devto = distribution.get("devto")
    return devto if isinstance(devto, dict) else None


@router.get("/dev.to", response_model=DevtoDistribution | None)
def get_devto_distribution_dot(user_id: str = Depends(get_verified_id)) -> DevtoDistribution | None:
    return get_devto_distribution(user_id)


@router.get("/dev-to", response_model=DevtoDistribution | None)
def get_devto_distribution_dash(user_id: str = Depends(get_verified_id)) -> DevtoDistribution | None:
    return get_devto_distribution(user_id)


@router.put("/devto", response_model=UserProfile)
def put_devto_distribution(
    payload: DevtoDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    if payload.storeInCloud:
        distributions_service.upsert_devto_access_token(user_id, payload.accessToken)
    else:
        # If browser storage is chosen, clear cloud copy to keep a single source of truth.
        distributions_service.remove_devto_access_token(user_id)

    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "devtoIntegrated": True,
                "devtoStoreInCloud": payload.storeInCloud,
            }
        },
    )


@router.put("/dev.to", response_model=UserProfile)
def put_devto_distribution_dot(
    payload: DevtoDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    return put_devto_distribution(payload, user_id)


@router.put("/dev-to", response_model=UserProfile)
def put_devto_distribution_dash(
    payload: DevtoDistributionUpsert,
    user_id: str = Depends(get_verified_id),
) -> UserProfile:
    return put_devto_distribution(payload, user_id)


@router.delete("/devto", response_model=UserProfile)
def revoke_devto_distribution(user_id: str = Depends(get_verified_id)) -> UserProfile:
    distributions_service.remove_devto_access_token(user_id)
    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "devtoIntegrated": False,
                "devtoStoreInCloud": False,
            }
        },
    )


@router.delete("/dev.to", response_model=UserProfile)
def revoke_devto_distribution_dot(user_id: str = Depends(get_verified_id)) -> UserProfile:
    return revoke_devto_distribution(user_id)


@router.delete("/dev-to", response_model=UserProfile)
def revoke_devto_distribution_dash(user_id: str = Depends(get_verified_id)) -> UserProfile:
    return revoke_devto_distribution(user_id)


@router.post("/devto/publish", response_model=DistributionPublishResult)
def publish_devto_distribution(
    payload: DistributionPublishInput,
    user_id: str = Depends(get_verified_id),
) -> DistributionPublishResult:
    paper_doc = _require_owned_paper(user_id, payload)
    user_doc = user_service.get_by_id(user_id)
    username = str(user_doc.get("username") or "").strip()
    slug = normalize_slug(payload.slug)
    title = payload.title.strip()
    body = payload.body.strip()

    if not username:
        raise HTTPException(status_code=400, detail="User handle is missing.")
    if not slug:
        raise HTTPException(status_code=400, detail="Paper slug is required before distributing.")
    if not title:
        raise HTTPException(status_code=400, detail="Paper title is required before distributing.")
    if not body:
        raise HTTPException(status_code=400, detail="Paper body is required before distributing.")

    access_token = _resolve_distribution_access_token("devto", user_id, payload.accessToken)
    metadata_tags = _extract_tags(payload.metadata)
    devto_tags = [normalize_slug(tag) for tag in metadata_tags if normalize_slug(tag)][:4]
    article_url = _build_public_article_url(username, slug)
    description = _extract_description(payload.metadata) or title
    thumbnail_url = _extract_thumbnail_url(payload, paper_doc)

    article_payload: dict[str, Any] = {
        "title": title,
        "body_markdown": payload.body,
        "published": True,
        "canonical_url": article_url,
        "description": description,
        **({"tags": devto_tags} if devto_tags else {}),
    }
    if thumbnail_url:
        article_payload["main_image"] = thumbnail_url

    article = distributions_service.publish_devto_article(access_token, article_payload)
    article_url_response = str(article.get("url") or "").strip()
    if not article_url_response:
        path = str(article.get("path") or "").strip()
        article_url_response = f"https://dev.to{path}" if path.startswith("/") else None

    return DistributionPublishResult(
        platform="devto",
        postId=str(article.get("id")),
        url=article_url_response,
    )
