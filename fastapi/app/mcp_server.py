from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from mcp.server.auth.handlers.authorize import AuthorizationHandler
from mcp.server.auth.handlers.register import RegistrationHandler
from mcp.server.auth.handlers.token import ClientAuthenticator, TokenHandler
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import TokenError
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions
from mcp.server.fastmcp import FastMCP

from app.core.firestore_store import firestore_store
from app.services.auth_service import get_verified_id
from app.services.collections_service import collections_service
from app.services.mcp_oauth_service import (
    get_configured_public_api_url,
    get_public_api_url,
    mcp_oauth_provider,
    mcp_token_verifier,
)
from app.services.paper_metadata_service import paper_metadata_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.services.user_service import user_service
from app.utils.mcp_auth import (
    list_mcp_tokens_for_user,
    mcp_token_service,
    revoke_mcp_token,
)

MCP_REQUIRED_SCOPES = ["mcp"]
MCP_HTTP_PREFIX = "/mcp"
client_registration_options = ClientRegistrationOptions(
    enabled=True,
    valid_scopes=MCP_REQUIRED_SCOPES,
    default_scopes=MCP_REQUIRED_SCOPES,
)


def _metadata_payload(request: Request | None = None) -> dict[str, Any]:
    base_url = _resolve_public_api_url(request)
    return {
        "issuer": base_url,
        "authorization_endpoint": f"{base_url}{MCP_HTTP_PREFIX}/authorize",
        "token_endpoint": f"{base_url}{MCP_HTTP_PREFIX}/token",
        "registration_endpoint": f"{base_url}{MCP_HTTP_PREFIX}/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
        "scopes_supported": MCP_REQUIRED_SCOPES,
    }


def _resolve_public_api_url(request: Request | None = None) -> str:
    configured = get_configured_public_api_url()
    if configured:
        return configured

    if request is not None:
        forwarded_proto = str(request.headers.get("x-forwarded-proto") or "").strip()
        forwarded_host = str(request.headers.get("x-forwarded-host") or "").strip()
        if forwarded_proto and forwarded_host:
            return f"{forwarded_proto}://{forwarded_host}".rstrip("/")
        return str(request.base_url).rstrip("/")

    return get_public_api_url()


def _mcp_server_url(request: Request | None = None) -> str:
    return f"{_resolve_public_api_url(request)}{MCP_HTTP_PREFIX}"


def _mcp_http_url(request: Request | None = None) -> str:
    return f"{_mcp_server_url(request)}/"


def _protected_resource_metadata_payload(request: Request | None = None) -> dict[str, Any]:
    return {
        "resource": _mcp_server_url(request),
        "authorization_servers": [_resolve_public_api_url(request)],
        "scopes_supported": MCP_REQUIRED_SCOPES,
        "bearer_methods_supported": ["header"],
        "resource_name": "Whitepapper MCP",
    }


def _mcp_connection_payload(request: Request | None = None) -> dict[str, Any]:
    mcp_url = _mcp_http_url(request)
    manual_config = {
        "servers": {
            "whitepapper": {
                "url": mcp_url,
                "type": "http",
            }
        },
        "inputs": [],
    }
    return {
        "serverName": "whitepapper",
        "transport": "http",
        "endpointUrl": mcp_url,
        "manualConfig": manual_config,
    }


def _mcp_auth_settings() -> AuthSettings:
    return AuthSettings(
        issuer_url=_resolve_public_api_url(),
        resource_server_url=_mcp_server_url(),
        required_scopes=MCP_REQUIRED_SCOPES,
        client_registration_options=client_registration_options,
    )


@dataclass(frozen=True)
class McpRequestContext:
    user_id: str
    project_id: str


def _require_owned_project(project_id: str, user_id: str) -> dict[str, Any]:
    project = projects_service.get_by_id(project_id)
    if str(project.get("ownerId") or "") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return project


def _require_tool_context() -> McpRequestContext:
    access_token = get_access_token()
    raw_token = str(access_token.token if access_token else "").strip()
    if not raw_token:
        raise TokenError("invalid_token", "Missing bearer token.")

    token_doc = mcp_token_service.resolve_token_doc(raw_token)
    if not token_doc:
        raise TokenError("invalid_token", "Bearer token is invalid or expired.")

    mcp_token_service.increment_usage_for_raw_token(raw_token)
    return McpRequestContext(
        user_id=str(token_doc.get("userId") or ""),
        project_id=str(token_doc.get("projectId") or ""),
    )


def _get_project_paper(paper_id: str, project_id: str) -> dict[str, Any] | None:
    paper = papers_service.get_by_id(paper_id)
    if not paper or str(paper.get("projectId") or "") != project_id:
        return None
    return paper


@lru_cache(maxsize=1)
def _build_mcp_server() -> FastMCP:
    server = FastMCP(
        name="whitepapper",
        instructions=(
            "Use get_project_context first. Create collections explicitly when needed. "
            "Never assume project_id from user input because it is derived from the bearer token."
        ),
        token_verifier=mcp_token_verifier,
        auth=_mcp_auth_settings(),
        streamable_http_path="/",
    )

    def _paper_seo(paper: dict | None) -> dict[str, str]:
        metadata = (paper or {}).get("metadata") or {}
        title = str(metadata.get("ogTitle") or metadata.get("title") or (paper or {}).get("title") or "").strip()
        description = str(metadata.get("metaDescription") or "").strip()
        return {
            "title": title or str((paper or {}).get("title") or "").strip(),
            "description": description,
        }

    def _build_metadata_for_paper(paper: dict, *, seo_title: str | None, seo_description: str | None) -> dict | None:
        author_doc = user_service.get_by_id(str(paper.get("ownerId") or ""))
        project_doc = projects_service.get_by_id(str(paper.get("projectId") or ""))
        metadata = paper_metadata_service.build_metadata(
            paper_doc=paper,
            author_doc=author_doc,
            project_doc=project_doc,
        )
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

    @server.tool(
        description=(
            "Always call this tool first before any other tool. Read the project description and every "
            "collection's description carefully. Use this information to decide which collection new content "
            "belongs in. If no collection fits, create a new one with create_collection before creating the paper."
        )
    )
    def get_project_context() -> dict[str, Any]:
        context = _require_tool_context()
        project = projects_service.get_by_id(context.project_id)
        collections = collections_service.list_project_collections(context.project_id)
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

        standalone_papers = papers_service.list_by_project_id(context.project_id, standalone=True)
        return {
            "project_id": context.project_id,
            "project_name": project.get("name"),
            "project_description": project.get("description") or "",
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

    @server.tool()
    def get_paper(paper_id: str) -> dict[str, Any]:
        context = _require_tool_context()
        paper = _get_project_paper(paper_id, context.project_id)
        if not paper:
            return {"error": "not_found"}
        return {
            "id": paper.get("paperId"),
            "slug": paper.get("slug"),
            "title": paper.get("title"),
            "markdown": paper.get("body") or "",
            "collection_id": paper.get("collectionId"),
            "seo": _paper_seo(paper),
        }

    @server.tool()
    def create_paper(
        title: str,
        slug: str,
        markdown: str,
        collection_id: str | None = None,
        seo_title: str | None = None,
        seo_description: str | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()

        normalized_slug = normalize_slug(slug)
        if not normalized_slug:
            return {"error": "invalid_slug", "message": "Slug is invalid."}

        existing = firestore_store.find_by_fields("papers", {"projectId": context.project_id, "slug": normalized_slug})
        if existing:
            return {"error": "slug_taken", "message": "A paper with this slug already exists"}

        if collection_id:
            collection = collections_service.get_by_id(collection_id)
            if str(collection.get("projectId") or "") != context.project_id:
                return {"error": "collection_not_found"}
        created = papers_service.create(
            context.user_id,
            {
                "projectId": context.project_id,
                "collectionId": collection_id,
                "title": title,
                "slug": normalized_slug,
                "body": markdown or "",
            },
        )
        paper_id = str(created.get("paperId") or "")
        paper = papers_service.get_by_id(paper_id)
        if paper and (seo_title or seo_description is not None):
            metadata = _build_metadata_for_paper(
                paper,
                seo_title=seo_title or title,
                seo_description=seo_description if seo_description is not None else "",
            )
            papers_service.update(paper_id, {"metadata": metadata})
        return {"id": paper_id, "slug": normalized_slug}

    @server.tool()
    def update_paper(
        paper_id: str,
        title: str | None = None,
        markdown: str | None = None,
        seo_title: str | None = None,
        seo_description: str | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()
        paper = _get_project_paper(paper_id, context.project_id)
        if not paper:
            return {"error": "not_found"}

        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if markdown is not None:
            payload["body"] = markdown

        if payload:
            papers_service.update(paper_id, payload)
            paper = papers_service.get_by_id(paper_id)

        if paper and (seo_title is not None or seo_description is not None):
            metadata = _build_metadata_for_paper(
                paper,
                seo_title=seo_title,
                seo_description=seo_description,
            )
            papers_service.update(paper_id, {"metadata": metadata})
        return {"updated": True}

    @server.tool()
    def delete_paper(paper_id: str) -> dict[str, Any]:
        context = _require_tool_context()
        paper = _get_project_paper(paper_id, context.project_id)
        if not paper:
            return {"error": "not_found"}
        title = str(paper.get("title") or "")
        papers_service.delete(paper_id)
        return {"deleted": True, "title": title}

    @server.tool()
    def update_project_description(markdown: str) -> dict[str, Any]:
        context = _require_tool_context()
        projects_service.update(context.project_id, {"description": markdown})
        return {"updated": True}

    @server.tool(
        description=(
            "Always provide a clear one-sentence description of what kind of content belongs in this collection. "
            "This description is used by AI agents to route content correctly."
        )
    )
    def create_collection(name: str, description: str = "") -> dict[str, Any]:
        context = _require_tool_context()
        created = collections_service.create(
            context.user_id,
            {
                "projectId": context.project_id,
                "name": name,
                "description": description or "",
            },
        )
        return {"id": created.get("collectionId"), "name": created.get("name")}

    @server.tool()
    def update_collection(
        collection_id: str,
        name: str | None = None,
        description: str | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()
        collection = collections_service.get_by_id(collection_id)
        if str(collection.get("projectId") or "") != context.project_id:
            return {"error": "not_found"}
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if description is not None:
            payload["description"] = description
        collections_service.update(collection_id, payload)
        return {"updated": True}

    @server.tool()
    def delete_collection(collection_id: str, delete_papers: bool = False) -> dict[str, Any]:
        context = _require_tool_context()
        collection = collections_service.get_by_id(collection_id)
        if str(collection.get("projectId") or "") != context.project_id:
            return {"error": "not_found"}

        papers = papers_service.list_by_collection_id(collection_id)
        papers_deleted = 0
        papers_moved = 0
        if delete_papers:
            for paper in papers:
                papers_service.delete(str(paper.get("paperId") or ""))
                papers_deleted += 1
        else:
            project = projects_service.get_by_id(context.project_id)
            next_status = "published" if bool(project.get("isPublic")) else "draft"
            for paper in papers:
                papers_service.update(
                    str(paper.get("paperId") or ""),
                    {
                        "collectionId": None,
                        "projectId": context.project_id,
                        "status": next_status,
                    },
                )
                papers_moved += 1
        firestore_store.delete("collections", collection_id)
        return {
            "deleted": True,
            "papers_moved": papers_moved,
            "papers_deleted": papers_deleted,
        }

    return server


@lru_cache(maxsize=1)
def build_mcp_app():
    return _build_mcp_server().streamable_http_app()


def get_mcp_session_manager():
    return _build_mcp_server().session_manager


def build_mcp_router() -> APIRouter:
    router = APIRouter(tags=["mcp"])
    authorization_handler = AuthorizationHandler(mcp_oauth_provider)
    token_handler = TokenHandler(mcp_oauth_provider, ClientAuthenticator(mcp_oauth_provider))
    registration_handler = RegistrationHandler(mcp_oauth_provider, client_registration_options)

    def _json_no_cache(payload: dict[str, Any]) -> JSONResponse:
        return JSONResponse(payload, headers={"Cache-Control": "no-store, no-cache"})

    @router.get("/.well-known/oauth-authorization-server")
    async def oauth_metadata(request: Request) -> JSONResponse:
        return _json_no_cache(_metadata_payload(None if get_configured_public_api_url() else request))

    @router.get("/.well-known/oauth-authorization-server/mcp")
    async def oauth_metadata_mcp(request: Request) -> JSONResponse:
        return _json_no_cache(_metadata_payload(None if get_configured_public_api_url() else request))

    @router.get("/.well-known/openid-configuration")
    async def openid_metadata(request: Request) -> JSONResponse:
        return _json_no_cache(_metadata_payload(None if get_configured_public_api_url() else request))

    @router.get("/.well-known/openid-configuration/mcp")
    async def openid_metadata_mcp(request: Request) -> JSONResponse:
        return _json_no_cache(_metadata_payload(None if get_configured_public_api_url() else request))

    @router.get("/.well-known/oauth-protected-resource")
    async def protected_resource_metadata_root(request: Request) -> JSONResponse:
        return _json_no_cache(_protected_resource_metadata_payload(request))

    @router.get("/.well-known/oauth-protected-resource/mcp")
    async def protected_resource_metadata_mcp(request: Request) -> JSONResponse:
        return _json_no_cache(_protected_resource_metadata_payload(request))

    mcp_router = APIRouter(prefix=MCP_HTTP_PREFIX)

    @mcp_router.get("/config")
    async def get_mcp_connection_info(request: Request) -> dict[str, Any]:
        return _mcp_connection_payload(request)

    @mcp_router.get("/authorize")
    async def authorize_get(request: Request):
        return await authorization_handler.handle(request)

    @mcp_router.post("/authorize")
    async def authorize_post(request: Request):
        return await authorization_handler.handle(request)

    @mcp_router.post("/token")
    async def token_exchange(request: Request):
        return await token_handler.handle(request)

    @mcp_router.post("/register")
    async def register_client(request: Request):
        return await registration_handler.handle(request)

    @mcp_router.get("/oauth/request/{request_id}")
    async def get_oauth_request(request_id: str) -> dict[str, Any]:
        request_doc = mcp_oauth_provider.get_pending_request(request_id)
        if not request_doc:
            raise HTTPException(status_code=404, detail="Authorization request not found.")
        return {
            "requestId": request_doc.get("requestId"),
            "clientId": request_doc.get("clientId"),
            "clientName": request_doc.get("clientName"),
            "scopes": request_doc.get("scopes") or [],
        }

    @mcp_router.post("/oauth/complete")
    async def complete_oauth_request(
        payload: dict[str, str],
        user_id: str = Depends(get_verified_id),
    ) -> dict[str, str]:
        request_id = str(payload.get("requestId") or "").strip()
        project_id = str(payload.get("projectId") or "").strip()
        if not request_id or not project_id:
            raise HTTPException(status_code=400, detail="requestId and projectId are required.")
        _require_owned_project(project_id, user_id)
        try:
            redirect_to = mcp_oauth_provider.complete_authorization_request(
                request_id=request_id,
                user_id=user_id,
                project_id=project_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return {"redirectTo": redirect_to}

    @router.get("/projects/{project_id}/mcp-tokens")
    def get_project_mcp_tokens(project_id: str, user_id: str = Depends(get_verified_id)) -> list[dict]:
        _require_owned_project(project_id, user_id)
        return [
            token
            for token in list_mcp_tokens_for_user(user_id)
            if str(token.get("projectId") or "") == project_id
        ]

    @router.delete("/projects/{project_id}/mcp-tokens/{token_id}")
    def delete_project_mcp_token(project_id: str, token_id: str, user_id: str = Depends(get_verified_id)) -> dict[str, bool]:
        _require_owned_project(project_id, user_id)
        token_doc = mcp_token_service.get_by_id(token_id)
        if not token_doc or str(token_doc.get("projectId") or "") != project_id:
            raise HTTPException(status_code=404, detail="MCP token not found.")
        revoke_mcp_token(token_id)
        return {"ok": True}

    router.include_router(mcp_router)
    return router
