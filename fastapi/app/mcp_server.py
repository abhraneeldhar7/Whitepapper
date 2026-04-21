from __future__ import annotations

from functools import lru_cache
import logging
import secrets
from typing import Any
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastmcp import FastMCP
from fastmcp.exceptions import AuthorizationError
from fastmcp.server.auth.providers.clerk import ClerkProvider
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext
from pydantic import ValidationError

from app.core.config import get_settings
from app.schemas.entities import PaperMetadata
from app.services.auth_service import get_verified_id
from app.services.collections_service import collections_service
from app.services.mcp_auth import mcp_authorization_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.services.user_service import user_service

MCP_HTTP_PREFIX = "/mcp"
MCP_SCOPES = ["openid", "email", "profile"]
logger = logging.getLogger(__name__)


def _settings():
    return get_settings()


def _required_env(value: str | None, env_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise RuntimeError(f"{env_name} must be configured.")
    return normalized


def _public_api_url() -> str:
    return _required_env(_settings().public_api_url, "PUBLIC_API_URL").rstrip("/")


def _public_site_url() -> str:
    return _required_env(_settings().public_site_url, "PUBLIC_SITE_URL").rstrip("/")


def _mcp_base_url() -> str:
    return f"{_public_api_url()}{MCP_HTTP_PREFIX}"


def _clerk_oauth_domain() -> str:
    discovery_url = _required_env(_settings().clerk_oauth_discovery_url, "CLERK_OAUTH_DISCOVERY_URL")
    parsed = urlparse(discovery_url)
    if not parsed.netloc:
        raise RuntimeError("CLERK_OAUTH_DISCOVERY_URL must be a valid URL.")
    return parsed.netloc


def _clerk_oauth_redirect_path() -> str:
    redirect_uri = _required_env(_settings().clerk_oauth_redirect_uri, "CLERK_OAUTH_REDIRECT_URI")
    parsed_redirect = urlparse(redirect_uri)
    if not parsed_redirect.path:
        raise RuntimeError("CLERK_OAUTH_REDIRECT_URI must include a path.")

    mcp_path = urlparse(_mcp_base_url()).path.rstrip("/")
    redirect_path = parsed_redirect.path
    if mcp_path and redirect_path.startswith(mcp_path):
        redirect_path = redirect_path[len(mcp_path):] or "/"
    if not redirect_path.startswith("/"):
        redirect_path = f"/{redirect_path}"
    return redirect_path


def _json_no_cache(payload: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(payload, status_code=status_code, headers={"Cache-Control": "no-store, no-cache"})


def _mcp_connection_payload() -> dict[str, Any]:
    endpoint_url = _mcp_base_url()
    return {
        "serverName": "whitepapper",
        "transport": "http",
        "endpointUrl": endpoint_url,
        "manualConfig": {
            "servers": {
                "whitepapper": {
                    "url": endpoint_url,
                    "type": "http",
                }
            },
            "inputs": [],
        },
    }


def _project_payload(project: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": project.get("projectId"),
        "name": project.get("name"),
        "slug": project.get("slug"),
        "description": project.get("description") or "",
        "content_guidelines": project.get("contentGuidelines") or "",
        "logo_url": project.get("logoUrl"),
        "is_public": bool(project.get("isPublic")),
        "pages_number": int(project.get("pagesNumber") or 0),
        "created_at": project.get("createdAt"),
        "updated_at": project.get("updatedAt"),
    }


def _collection_payload(collection: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": collection.get("collectionId"),
        "project_id": collection.get("projectId"),
        "name": collection.get("name"),
        "slug": collection.get("slug"),
        "description": collection.get("description") or "",
        "is_public": bool(collection.get("isPublic")),
        "pages_number": int(collection.get("pagesNumber") or 0),
        "created_at": collection.get("createdAt"),
        "updated_at": collection.get("updatedAt"),
    }


def _paper_seo(paper: dict[str, Any] | None) -> dict[str, str]:
    metadata = (paper or {}).get("metadata") or {}
    title = str(metadata.get("ogTitle") or metadata.get("title") or (paper or {}).get("title") or "").strip()
    description = str(metadata.get("metaDescription") or "").strip()
    return {
        "title": title or str((paper or {}).get("title") or "").strip(),
        "description": description,
    }


def _list_owned_projects(user_id: str) -> list[dict[str, Any]]:
    projects = projects_service.list_owned(user_id)
    projects.sort(key=lambda item: str(item.get("updatedAt") or item.get("createdAt") or ""), reverse=True)
    return projects


def _resolve_project_for_user(user_id: str, project_ref: str) -> dict[str, Any]:
    ref = str(project_ref or "").strip()
    if not ref:
        raise HTTPException(status_code=400, detail="project_id is required.")

    try:
        project = projects_service.get_by_id(ref)
        if str(project.get("ownerId") or "") == user_id:
            return project
    except HTTPException:
        pass

    lowered = ref.lower()
    for project in _list_owned_projects(user_id):
        slug = str(project.get("slug") or "").lower()
        name = str(project.get("name") or "").strip().lower()
        if lowered == slug or lowered == name:
            return project

    raise HTTPException(status_code=404, detail="Project not found.")


def _require_owned_collection(user_id: str, collection_id: str) -> dict[str, Any]:
    collection = collections_service.get_by_id(collection_id)
    if str(collection.get("ownerId") or "") != user_id:
        raise HTTPException(status_code=404, detail="Collection not found.")
    return collection


def _require_owned_paper(user_id: str, paper_id: str) -> dict[str, Any]:
    paper = papers_service.get_by_id(paper_id)
    if not paper or str(paper.get("ownerId") or "") != user_id:
        raise HTTPException(status_code=404, detail="Paper not found.")
    return paper


def _get_project_context_payload(project: dict[str, Any]) -> dict[str, Any]:
    project_id = str(project.get("projectId") or "")
    collections = collections_service.list_project_collections(project_id)
    collection_payload: list[dict[str, Any]] = []
    for collection in collections:
        collection_id = str(collection.get("collectionId") or "")
        papers = papers_service.list_by_collection_id(collection_id)
        collection_payload.append(
            {
                "id": collection_id,
                "name": collection.get("name"),
                "description": collection.get("description") or "",
                "papers": [
                    {
                        "id": paper.get("paperId"),
                        "slug": paper.get("slug"),
                        "title": paper.get("title"),
                    }
                    for paper in papers
                ],
            }
        )

    standalone_papers = papers_service.list_by_project_id(project_id, standalone=True)
    return {
        "project_id": project_id,
        "project_name": project.get("name"),
        "project_description": project.get("description") or "",
        "content_guidelines": project.get("contentGuidelines") or "",
        "collections": collection_payload,
        "standalone_papers": [
            {
                "id": paper.get("paperId"),
                "slug": paper.get("slug"),
                "title": paper.get("title"),
            }
            for paper in standalone_papers
        ],
    }


def _build_metadata_for_paper(paper: dict[str, Any], *, seo_title: str | None, seo_description: str | None) -> dict[str, Any]:
    metadata = papers_service.generate_metadata_preview(paper)
    if seo_title:
        clean_title = seo_title.strip()
        if clean_title:
            metadata["title"] = clean_title
            metadata["ogTitle"] = clean_title
            metadata["twitterTitle"] = clean_title
            metadata["headline"] = clean_title
    if seo_description is not None:
        clean_description = seo_description.strip()
        metadata["metaDescription"] = clean_description
        metadata["ogDescription"] = clean_description
        metadata["twitterDescription"] = clean_description
        metadata["abstract"] = clean_description or metadata.get("abstract", "")
    return metadata


def _normalize_metadata_payload_for_paper(paper: dict[str, Any], metadata: dict[str, Any]) -> dict[str, Any]:
    generated = papers_service.generate_metadata_preview(paper)
    merged = {**generated, **metadata}
    return PaperMetadata.model_validate(merged).model_dump(mode="json")


def _current_mcp_user_id() -> str:
    token = get_access_token()
    user_id = str((token.claims if token else {}).get("sub") or "").strip()
    if not user_id:
        raise AuthorizationError("Missing authenticated Whitepapper user.")
    return user_id


def _token_hash_from_access_token() -> str:
    token = get_access_token()
    raw_token = str(getattr(token, "token", "") or "").strip()
    return mcp_authorization_service.hash_token(raw_token) if raw_token else ""


async def _resolve_client_name(provider: ClerkProvider, client_id: str) -> str | None:
    if not client_id:
        return None
    try:
        client = await provider.get_client(client_id)
    except Exception:
        return None
    return str(getattr(client, "client_name", "") or "").strip() or None


class WhitepapperClerkProvider(ClerkProvider):
    async def _show_consent_page(self, request: Request) -> RedirectResponse:
        txn_id = request.query_params.get("txn_id")
        if not txn_id:
            raise HTTPException(status_code=400, detail="Invalid or expired transaction.")

        txn_model = await self._transaction_store.get(key=txn_id)
        if not txn_model:
            raise HTTPException(status_code=400, detail="Invalid or expired transaction.")

        site_url = _public_site_url()
        consent_url = f"{site_url}/mcp/connect?txn_id={urlencode({'txn_id': txn_id})[7:]}"
        return RedirectResponse(url=consent_url, status_code=302)


class WhitepapperAuthorizationMiddleware(Middleware):
    def __init__(self, provider: WhitepapperClerkProvider) -> None:
        super().__init__()
        self.provider = provider

    async def on_request(self, context: MiddlewareContext, call_next):
        token = get_access_token()
        if token is None:
            return await call_next(context)

        user_id = str(token.claims.get("sub") or "").strip()
        raw_aud = token.claims.get("aud")
        aud_value = raw_aud[0] if isinstance(raw_aud, list) and raw_aud else raw_aud
        client_id = str(
            token.client_id
            or token.claims.get("azp")
            or token.claims.get("client_id")
            or aud_value
            or ""
        ).strip()
        token_hash = _token_hash_from_access_token()
        if not user_id:
            raise AuthorizationError("Missing MCP authorization context.")
        if not client_id:
            raise AuthorizationError("Missing MCP authorization context.")

        authorization_id = mcp_authorization_service.authorization_id(user_id, client_id)
        try:
            if mcp_authorization_service.is_token_revoked(authorization_id, token_hash):
                raise AuthorizationError("This MCP connection has been revoked. Reconnect to continue.")
            if not mcp_authorization_service.is_user_usage_within_limit(user_id):
                raise AuthorizationError("Monthly MCP usage limit reached for this Whitepapper account.")

            client_name = await _resolve_client_name(self.provider, client_id)
            mcp_authorization_service.upsert_authorization(
                user_id=user_id,
                client_id=client_id,
                agent_name=client_name,
                scopes=list(token.scopes or []),
                token_hash=token_hash,
            )
        except AuthorizationError:
            raise
        except Exception:
            logger.exception(
                "MCP authorization state sync failed for user_id=%s client_id=%s",
                user_id,
                client_id,
            )

        result = await call_next(context)
        if context.method not in {"initialize", "notifications/initialized", "ping"}:
            try:
                mcp_authorization_service.increment_user_usage(user_id)
            except Exception:
                logger.exception("Failed to increment MCP usage for user_id=%s", user_id)
        return result


@lru_cache(maxsize=1)
def _build_mcp_server() -> FastMCP:
    settings = _settings()
    provider = WhitepapperClerkProvider(
        domain=_clerk_oauth_domain(),
        client_id=_required_env(settings.clerk_oauth_client_id, "CLERK_OAUTH_CLIENT_ID"),
        client_secret=_required_env(settings.clerk_oauth_client_secret, "CLERK_OAUTH_CLIENT_SECRET"),
        base_url=_mcp_base_url(),
        issuer_url=_public_api_url(),
        redirect_path=_clerk_oauth_redirect_path(),
        required_scopes=MCP_SCOPES,
        valid_scopes=MCP_SCOPES,
    )

    server = FastMCP(
        name="whitepapper",
        instructions="""
You are connected to Whitepapper at the account level.
You can work across all projects owned by the signed-in user.

Session startup:
1. Call list_projects first.
2. Pick the relevant project and call get_project_context(project_id) before writing content for that project.
3. Never guess project, collection, or paper IDs. Use IDs returned by tools.

Rules:
- Project-scoped tools require a project_id.
- Collection and paper tools use entity IDs returned by prior tool calls.
- The page title is the H1. Do not add another H1 inside markdown.
- Do not use em dashes. Prefer commas or double hyphens.
- Keep slugs lowercase and hyphenated.
- Do not regenerate SEO unless explicitly requested.
""".strip(),
        auth=provider,
        middleware=[WhitepapperAuthorizationMiddleware(provider)],
    )

    @server.tool(description="List every project owned by the authenticated Whitepapper account.")
    def list_projects() -> list[dict[str, Any]]:
        user_id = _current_mcp_user_id()
        return [_project_payload(project) for project in _list_owned_projects(user_id)]

    @server.tool(description="Get full project context, including collections and paper titles, for one project.")
    def get_project_context(project_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = _resolve_project_for_user(user_id, project_id)
        return _get_project_context_payload(project)

    @server.tool(description="Get one project by ID, slug, or exact name.")
    def get_project(project_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = _resolve_project_for_user(user_id, project_id)
        return _project_payload(project)

    @server.tool(description="Create a new project in the authenticated Whitepapper account.")
    def create_project(
        name: str,
        slug: str | None = None,
        description: str | None = None,
        content_guidelines: str | None = None,
        logo_url: str | None = None,
        is_public: bool | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        payload: dict[str, Any] = {"name": name}
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        if content_guidelines is not None:
            payload["contentGuidelines"] = content_guidelines
        if logo_url is not None:
            payload["logoUrl"] = logo_url
        if is_public is not None:
            payload["isPublic"] = is_public
        created = projects_service.create(user_id, payload)
        return _project_payload(created)

    @server.tool(description="Update project fields. Only pass values that should change.")
    def update_project(
        project_id: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        content_guidelines: str | None = None,
        logo_url: str | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = _resolve_project_for_user(user_id, project_id)
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        if content_guidelines is not None:
            payload["contentGuidelines"] = content_guidelines
        if logo_url is not None:
            payload["logoUrl"] = logo_url
        updated = projects_service.update(str(project.get("projectId") or ""), payload) if payload else project
        return _project_payload(updated)

    @server.tool(description="Set project visibility.")
    def set_project_visibility(project_id: str, is_public: bool) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = _resolve_project_for_user(user_id, project_id)
        updated = projects_service.set_visibility(str(project.get("projectId") or ""), is_public)
        return _project_payload(updated)

    @server.tool(description="Delete a project permanently. Requires confirm=true.")
    def delete_project(project_id: str, confirm: bool = False) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = _resolve_project_for_user(user_id, project_id)
        if not confirm:
            return {"error": "confirm_required", "message": "Set confirm=true to delete this project."}
        projects_service.delete(str(project.get("projectId") or ""))
        return {"deleted": True}

    @server.tool(description="Overwrite the project description markdown for one project.")
    def update_project_description(project_id: str, markdown: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = _resolve_project_for_user(user_id, project_id)
        updated = projects_service.update(str(project.get("projectId") or ""), {"description": markdown})
        return _project_payload(updated)

    @server.tool(description="Create a collection inside a project.")
    def create_collection(
        project_id: str,
        name: str,
        description: str,
        slug: str | None = None,
        is_public: bool | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = _resolve_project_for_user(user_id, project_id)
        payload: dict[str, Any] = {
            "projectId": str(project.get("projectId") or ""),
            "name": name,
            "description": description,
        }
        if slug is not None:
            payload["slug"] = slug
        if is_public is not None:
            payload["isPublic"] = is_public
        created = collections_service.create(user_id, payload)
        return _collection_payload(created)

    @server.tool(description="Get one collection by ID.")
    def get_collection(collection_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        collection = _require_owned_collection(user_id, collection_id)
        return _collection_payload(collection)

    @server.tool(description="Update a collection.")
    def update_collection(
        collection_id: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        is_public: bool | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        collection = _require_owned_collection(user_id, collection_id)
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        updated = collections_service.update(str(collection.get("collectionId") or ""), payload) if payload else collection
        if is_public is not None:
            updated = collections_service.set_visibility(str(collection.get("collectionId") or ""), is_public)
        return _collection_payload(updated)

    @server.tool(description="Set collection visibility.")
    def set_collection_visibility(collection_id: str, is_public: bool) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        collection = _require_owned_collection(user_id, collection_id)
        updated = collections_service.set_visibility(str(collection.get("collectionId") or ""), is_public)
        return _collection_payload(updated)

    @server.tool(description="Delete a collection permanently. Requires confirm=true.")
    def delete_collection(collection_id: str, confirm: bool = False) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        collection = _require_owned_collection(user_id, collection_id)
        if not confirm:
            return {"error": "confirm_required", "message": "Set confirm=true to delete this collection."}
        collections_service.delete(str(collection.get("collectionId") or ""))
        return {"deleted": True}

    @server.tool(description="Create a paper in a project or collection.")
    def create_paper(
        title: str = "Untitled Paper",
        slug: str | None = None,
        markdown: str | None = None,
        project_id: str | None = None,
        collection_id: str | None = None,
        thumbnail_url: str | None = None,
        status: str | None = None,
        seo_title: str | None = None,
        seo_description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        payload: dict[str, Any] = {
            "title": title,
            "body": markdown or "",
        }
        if slug is not None:
            payload["slug"] = slug
        if thumbnail_url is not None:
            payload["thumbnailUrl"] = thumbnail_url
        if status is not None:
            payload["status"] = status

        if collection_id:
            collection = _require_owned_collection(user_id, collection_id)
            payload["collectionId"] = str(collection.get("collectionId") or "")
            payload["projectId"] = str(collection.get("projectId") or "")
        elif project_id:
            project = _resolve_project_for_user(user_id, project_id)
            payload["projectId"] = str(project.get("projectId") or "")

        created = papers_service.create(user_id, payload)
        paper = _require_owned_paper(user_id, str(created.get("paperId") or ""))

        if paper:
            next_metadata: dict[str, Any] | None = None
            try:
                if metadata is not None:
                    next_metadata = _normalize_metadata_payload_for_paper(paper, metadata)
                elif seo_title is not None or seo_description is not None:
                    next_metadata = _build_metadata_for_paper(
                        paper,
                        seo_title=seo_title,
                        seo_description=seo_description,
                    )
            except ValidationError as exc:
                return {"error": "invalid_metadata", "message": str(exc)}

            if next_metadata is not None:
                papers_service.update(str(paper.get("paperId") or ""), {"metadata": next_metadata})
                paper = _require_owned_paper(user_id, str(paper.get("paperId") or ""))

        return {
            "id": paper.get("paperId"),
            "project_id": paper.get("projectId"),
            "collection_id": paper.get("collectionId"),
            "slug": paper.get("slug"),
            "title": paper.get("title"),
            "metadata": paper.get("metadata"),
            "seo": _paper_seo(paper),
        }

    @server.tool(description="Get one paper by ID.")
    def get_paper(paper_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        paper = _require_owned_paper(user_id, paper_id)
        return {
            "id": paper.get("paperId"),
            "slug": paper.get("slug"),
            "title": paper.get("title"),
            "markdown": paper.get("body") or "",
            "collection_id": paper.get("collectionId"),
            "project_id": paper.get("projectId"),
            "thumbnail_url": paper.get("thumbnailUrl"),
            "metadata": paper.get("metadata") or None,
            "seo": _paper_seo(paper),
        }

    @server.tool(description="Update a paper. Only pass values that should change.")
    def update_paper(
        paper_id: str,
        title: str | None = None,
        slug: str | None = None,
        markdown: str | None = None,
        collection_id: str | None = None,
        thumbnail_url: str | None = None,
        status: str | None = None,
        seo_title: str | None = None,
        seo_description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        paper = _require_owned_paper(user_id, paper_id)
        payload: dict[str, Any] = {}

        if title is not None:
            payload["title"] = title
        if slug is not None:
            normalized_slug = normalize_slug(slug)
            if not normalized_slug:
                return {"error": "invalid_slug", "message": "Slug is invalid."}
            if not papers_service.is_slug_available(user_id, normalized_slug, paper_id):
                return {"error": "slug_taken", "message": "A paper with this slug already exists."}
            payload["slug"] = normalized_slug
        if markdown is not None:
            payload["body"] = markdown
        if thumbnail_url is not None:
            payload["thumbnailUrl"] = str(thumbnail_url).strip() or None
        if status is not None:
            normalized_status = str(status).strip().lower()
            if normalized_status not in {"draft", "published", "archived"}:
                return {"error": "invalid_status", "message": "Allowed values: draft, published, archived."}
            payload["status"] = normalized_status
        if collection_id is not None:
            if not str(collection_id).strip():
                payload["collectionId"] = None
                payload["projectId"] = paper.get("projectId")
            else:
                collection = _require_owned_collection(user_id, collection_id)
                payload["collectionId"] = str(collection.get("collectionId") or "")
                payload["projectId"] = str(collection.get("projectId") or "")

        if payload:
            papers_service.update(paper_id, payload)
            paper = _require_owned_paper(user_id, paper_id)

        try:
            next_metadata: dict[str, Any] | None = None
            if metadata is not None:
                next_metadata = _normalize_metadata_payload_for_paper(paper, metadata)
            elif seo_title is not None or seo_description is not None:
                next_metadata = _build_metadata_for_paper(
                    paper,
                    seo_title=seo_title,
                    seo_description=seo_description,
                )
        except ValidationError as exc:
            return {"error": "invalid_metadata", "message": str(exc)}

        if next_metadata is not None:
            papers_service.update(paper_id, {"metadata": next_metadata})
            paper = _require_owned_paper(user_id, paper_id)

        return {
            "updated": True,
            "id": paper.get("paperId"),
            "slug": paper.get("slug"),
            "metadata": paper.get("metadata"),
            "seo": _paper_seo(paper),
        }

    @server.tool(description="Delete a paper permanently.")
    def delete_paper(paper_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        paper = _require_owned_paper(user_id, paper_id)
        title = str(paper.get("title") or "")
        papers_service.delete(paper_id)
        return {"deleted": True, "title": title}

    @server.tool(description="Return one random default thumbnail URL.")
    def get_random_default_thumbnail_url() -> dict[str, Any]:
        return {"url": papers_service.get_random_default_thumbnail_url()}

    @server.tool(description="Delete the current thumbnail for a paper.")
    def delete_paper_thumbnail(paper_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        paper = _require_owned_paper(user_id, paper_id)
        owner_id = str(paper.get("ownerId") or "")
        papers_service.delete_thumbnail(owner_id, paper_id)
        papers_service.update(paper_id, {"thumbnailUrl": None})
        return {"deleted": True}

    return server


@lru_cache(maxsize=1)
def build_mcp_app():
    return _build_mcp_server().http_app(path="/", transport="http")


def _get_mcp_provider() -> WhitepapperClerkProvider:
    provider = _build_mcp_server().auth
    if not isinstance(provider, WhitepapperClerkProvider):
        raise RuntimeError("MCP auth provider is not configured.")
    return provider


def build_mcp_router() -> APIRouter:
    router = APIRouter(tags=["mcp"])

    @router.get("/.well-known/oauth-authorization-server")
    async def oauth_authorization_server_alias() -> RedirectResponse:
        return RedirectResponse(url=f"{MCP_HTTP_PREFIX}/.well-known/oauth-authorization-server", status_code=307)

    @router.get("/.well-known/oauth-protected-resource")
    async def oauth_protected_resource_alias() -> RedirectResponse:
        return RedirectResponse(url=f"{MCP_HTTP_PREFIX}/.well-known/oauth-protected-resource/mcp/", status_code=307)

    @router.get(f"{MCP_HTTP_PREFIX}/config")
    async def get_mcp_connection_info() -> dict[str, Any]:
        return _mcp_connection_payload()

    @router.get(f"{MCP_HTTP_PREFIX}/consent/context")
    async def get_mcp_consent_context(
        txn_id: str,
        user_id: str = Depends(get_verified_id),
    ) -> dict[str, Any]:
        provider = _get_mcp_provider()
        txn_model = await provider._transaction_store.get(key=txn_id)
        if not txn_model:
            raise HTTPException(status_code=404, detail="Authorization request not found or expired.")

        txn = txn_model.model_dump()
        client = await provider.get_client(str(txn.get("client_id") or ""))
        client_name = str(getattr(client, "client_name", "") or txn.get("client_id") or "").strip()
        user_doc = user_service.get_by_id(user_id)
        return {
            "txnId": txn_id,
            "clientId": txn.get("client_id"),
            "clientName": client_name,
            "redirectUri": txn.get("client_redirect_uri"),
            "scopes": txn.get("scopes") or [],
            "user": {
                "displayName": user_doc.get("displayName"),
                "username": user_doc.get("username"),
                "email": user_doc.get("email"),
                "avatarUrl": user_doc.get("avatarUrl"),
            },
        }

    @router.post(f"{MCP_HTTP_PREFIX}/consent/decision")
    async def complete_mcp_consent(
        payload: dict[str, str],
        request: Request,
        user_id: str = Depends(get_verified_id),
    ) -> JSONResponse:
        txn_id = str(payload.get("txnId") or "").strip()
        action = str(payload.get("action") or "").strip().lower()
        if not txn_id:
            raise HTTPException(status_code=400, detail="txnId is required.")
        if action not in {"approve", "deny"}:
            raise HTTPException(status_code=400, detail="action must be approve or deny.")

        provider = _get_mcp_provider()
        txn_model = await provider._transaction_store.get(key=txn_id)
        if not txn_model:
            raise HTTPException(status_code=404, detail="Authorization request not found or expired.")

        txn = txn_model.model_dump()
        client_id = str(txn.get("client_id") or "").strip()
        client_name = await _resolve_client_name(provider, client_id)

        if action == "approve":
            mcp_authorization_service.clear_token_revocation(
                mcp_authorization_service.authorization_id(user_id, client_id),
            )
            consent_token = secrets.token_urlsafe(32)
            txn_model.consent_token = consent_token
            await provider._transaction_store.put(key=txn_id, value=txn_model, ttl=15 * 60)
            redirect_to = provider._build_upstream_authorize_url(txn_id, txn)
            response = _json_no_cache(
                {
                    "redirectTo": redirect_to,
                    "clientId": client_id,
                    "clientName": client_name,
                }
            )
            # Preserve FastMCP confused-deputy protection for custom consent UI.
            provider._set_consent_binding_cookie(request, response, txn_id, consent_token)
            return response

        callback_params = {
            "error": "access_denied",
            "state": str(txn.get("client_state") or ""),
        }
        redirect_uri = str(txn.get("client_redirect_uri") or "").strip()
        separator = "&" if "?" in redirect_uri else "?"
        return _json_no_cache(
            {
                "redirectTo": f"{redirect_uri}{separator}{urlencode(callback_params)}",
                "clientId": client_id,
                "clientName": client_name,
            }
        )

    @router.get(f"{MCP_HTTP_PREFIX}/authorizations")
    async def list_mcp_authorizations(user_id: str = Depends(get_verified_id)) -> dict[str, Any]:
        usage_doc = mcp_authorization_service.get_user_month_usage(user_id)
        return {
            "authorizations": [
                {
                    "authorizationId": item.get("authorizationId"),
                    "clientId": item.get("clientId"),
                    "agentName": item.get("agentName"),
                    "scopes": item.get("scopes") or [],
                    "createdAt": item.get("createdAt"),
                    "lastActive": item.get("lastActive"),
                }
                for item in mcp_authorization_service.list_authorizations_for_user(user_id)
            ],
            "usage": int(usage_doc.get("usage", 0)),
            "limitPerMonth": int(usage_doc.get("limitPerMonth", 0)),
        }

    @router.delete(f"{MCP_HTTP_PREFIX}/authorizations/{{authorization_id}}")
    async def revoke_mcp_authorization(authorization_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, Any]:
        if not mcp_authorization_service.revoke_authorization(user_id, authorization_id):
            raise HTTPException(status_code=404, detail="MCP authorization not found.")
        return {"ok": True}

    return router
