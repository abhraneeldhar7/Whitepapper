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
from app.schemas.entities import HashnodeDistribution, UserDoc
from app.services.auth_service import get_verified_id
from app.services.distributions import distributions_store_service, hashnode_distribution_service
from app.services.slug_utils import normalize_slug
from app.services.user_service import user_service

router = APIRouter()


class HashnodeDistributionUpsertRequest(BaseModel):
    accessToken: str = Field(min_length=1)
    storeInCloud: bool = False


class DistributionPublishResult(BaseModel):
    platform: Literal["hashnode", "devto"]
    postId: str
    url: str | None = None


@router.get("/hashnode", response_model=HashnodeDistribution | None)
def get_hashnode_distribution(user_id: str = Depends(get_verified_id)) -> HashnodeDistribution | None:
    distribution = distributions_store_service.get_by_user_id(user_id)
    hashnode = distribution.get("hashnode")
    return hashnode if isinstance(hashnode, dict) else None


@router.put("/hashnode", response_model=UserDoc)
def put_hashnode_distribution(
    payload: HashnodeDistributionUpsertRequest,
    user_id: str = Depends(get_verified_id),
) -> UserDoc:
    if payload.storeInCloud:
        distributions_store_service.upsert_hashnode_access_token(user_id, payload.accessToken)
    else:
        distributions_store_service.clear_hashnode_access_token(user_id)

    return user_service.update_user(
        user_id,
        {
            "preferences": {
                "hashnodeIntegrated": True,
                "hashnodeStoreInCloud": payload.storeInCloud,
            }
        },
    )


@router.delete("/hashnode", response_model=UserDoc)
def revoke_hashnode_distribution(user_id: str = Depends(get_verified_id)) -> UserDoc:
    distributions_store_service.remove_hashnode_distribution(user_id)
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
    paper_doc, title, body, slug, metadata, username = resolve_distribution_context(user_id, payload)
    access_token = resolve_distribution_access_token("hashnode", user_id, payload.accessToken)
    thumbnail_url = paper_doc.get("thumbnailUrl")
    publication_id = distributions_store_service.get_hashnode_publication_id(user_id)
    if not publication_id:
        publication_id = hashnode_distribution_service.fetch_publication_id(access_token)
        distributions_store_service.set_hashnode_publication_id(user_id, publication_id)

    article_url = build_public_article_url(username, slug)
    hashnode_tags = [
        {
            "slug": normalize_slug(tag),
            "name": tag,
        }
        for tag in extract_tags(metadata)
        if normalize_slug(tag)
    ]
    description = extract_description(metadata)

    post = hashnode_distribution_service.publish_post(
        access_token,
        {
            "title": title,
            "publicationId": publication_id,
            "contentMarkdown": body,
            "slug": slug,
            "settings": {
                "enableTableOfContent": False,
            },
            "originalArticleURL": article_url,
            **({"subtitle": description} if description else {}),
            **({"tags": hashnode_tags} if hashnode_tags else {}),
            **({"coverImageOptions": {"coverImageURL": thumbnail_url}} if thumbnail_url else {}),
        },
    )
    return DistributionPublishResult(
        platform="hashnode",
        postId=str(post.get("id")),
        url=str(post.get("url") or article_url),
    )
