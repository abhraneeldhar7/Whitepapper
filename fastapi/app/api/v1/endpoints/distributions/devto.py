from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.api.v1.endpoints.distributions.common import (
    DistributionPublishInput,
    build_public_article_url,
    extract_description,
    extract_tags,
    resolve_distribution_access_token,
    resolve_distribution_context,
)
from app.schemas.entities import DevtoDistribution, UserDoc
from app.services.auth_service import get_verified_id
from app.services.distributions import devto_distribution_service, distributions_store_service
from app.services.slug_utils import normalize_slug
from app.services.user_service import user_service

router = APIRouter()


class DevtoDistributionUpsertRequest(BaseModel):
    accessToken: str = Field(min_length=1)
    storeInCloud: bool = False


class DistributionPublishResult(BaseModel):
    platform: Literal["hashnode", "devto"]
    postId: str
    url: str | None = None


@router.get("/devto", response_model=DevtoDistribution | None)
def get_devto_distribution(user_id: str = Depends(get_verified_id)) -> DevtoDistribution | None:
    distribution = distributions_store_service.get_by_user_id(user_id)
    devto = distribution.get("devto")
    return devto if isinstance(devto, dict) else None


@router.put("/devto", response_model=UserDoc)
def put_devto_distribution(
    payload: DevtoDistributionUpsertRequest,
    user_id: str = Depends(get_verified_id),
) -> UserDoc:
    if payload.storeInCloud:
        distributions_store_service.upsert_devto_access_token(user_id, payload.accessToken)
    else:
        distributions_store_service.remove_devto_access_token(user_id)

    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "devtoIntegrated": True,
                "devtoStoreInCloud": payload.storeInCloud,
            }
        },
    )


@router.delete("/devto", response_model=UserDoc)
def revoke_devto_distribution(user_id: str = Depends(get_verified_id)) -> UserDoc:
    distributions_store_service.remove_devto_access_token(user_id)
    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "devtoIntegrated": False,
                "devtoStoreInCloud": False,
            }
        },
    )


@router.post("/devto/publish", response_model=DistributionPublishResult)
async def publish_devto_distribution(
    payload: DistributionPublishInput,
    user_id: str = Depends(get_verified_id),
) -> DistributionPublishResult:
    paper_doc, title, body, slug, metadata, username = resolve_distribution_context(user_id, payload)
    access_token = resolve_distribution_access_token("devto", user_id, payload.accessToken)
    thumbnail_url = paper_doc.get("thumbnailUrl")
    description = extract_description(metadata) or title
    article_url = build_public_article_url(username, slug)
    devto_tags = [normalize_slug(tag) for tag in extract_tags(metadata) if normalize_slug(tag)][:4]

    article = await devto_distribution_service.publish_article(
        access_token,
        {
            "article": {
                "title": title,
                "body_markdown": body,
                "published": True,
                "description": description,
                **({"tags": devto_tags} if devto_tags else {}),
                **({"main_image": thumbnail_url} if thumbnail_url else {}),
                **({"canonical_url": article_url} if article_url else {}),
            }
        },
    )
    article_url_response = str(article.get("url") or "").strip()
    if not article_url_response:
        path = str(article.get("path") or "").strip()
        article_url_response = f"https://dev.to{path}" if path.startswith("/") else None

    return DistributionPublishResult(
        platform="devto",
        postId=str(article.get("id")),
        url=article_url_response,
    )
