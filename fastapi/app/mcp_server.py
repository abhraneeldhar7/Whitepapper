from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from mcp.server.auth.middleware.auth_context import get_access_token  # pyright: ignore[reportMissingImports]
from mcp.server.auth.provider import TokenError  # pyright: ignore[reportMissingImports]
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions  # pyright: ignore[reportMissingImports]
from mcp.server.fastmcp import FastMCP  # pyright: ignore[reportMissingImports]
from mcp.server.transport_security import TransportSecuritySettings  # pyright: ignore[reportMissingImports]
from pydantic import ValidationError

from app.schemas.entities import PaperMetadata
from app.services.auth_service import get_verified_id
from app.services.collections_service import collections_service
from app.services.mcp_oauth_service import (
    get_public_api_url,
    mcp_oauth_service,
    mcp_token_verifier,
)
from app.services.mcp_auth import list_mcp_tokens_for_user, mcp_token_service, revoke_mcp_token
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug

MCP_REQUIRED_SCOPES = ["mcp"]
MCP_HTTP_PREFIX = "/mcp"


def _join_url(base_url: str, path: str | None = None) -> str:
    normalized_base = str(base_url or "").strip().rstrip("/")
    normalized_path = str(path or "").strip().strip("/")
    if not normalized_path:
        return normalized_base
    return f"{normalized_base}/{normalized_path}"


def _metadata_payload(*, issuer_url: str) -> dict[str, Any]:
    return {
        "issuer": issuer_url.rstrip("/"),
        "authorization_endpoint": _mcp_url("/authorize"),
        "token_endpoint": _mcp_url("/token"),
        "registration_endpoint": _mcp_url("/register"),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        # Support both methods for broader client compatibility.
        "code_challenge_methods_supported": ["S256", "plain"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": MCP_REQUIRED_SCOPES,
    }


def _protected_resource_payload(*, resource_url: str) -> dict[str, Any]:
    mcp_issuer = _mcp_url()
    root_issuer = get_public_api_url()
    authorization_servers = [mcp_issuer]
    if root_issuer != mcp_issuer:
        authorization_servers.append(root_issuer)
    # RFC 9728 protected resource metadata advertised via WWW-Authenticate resource_metadata.
    return {
        "resource": resource_url,
        "authorization_servers": authorization_servers,
        "bearer_methods_supported": ["header"],
        "scopes_supported": MCP_REQUIRED_SCOPES,
    }


def _mcp_url(path: str = "") -> str:
    return _join_url(get_public_api_url(), f"{MCP_HTTP_PREFIX}/{str(path or '').lstrip('/')}")


def _mcp_http_endpoint_url() -> str:
    return f"{_mcp_url()}/"


def _mcp_connection_payload() -> dict[str, Any]:
    mcp_url = _mcp_http_endpoint_url()
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
        issuer_url=_mcp_url(),
        resource_server_url=_mcp_url(),
        required_scopes=MCP_REQUIRED_SCOPES,
        client_registration_options=ClientRegistrationOptions(enabled=False),
    )


def _mcp_transport_security_settings() -> TransportSecuritySettings:
    # Requests arrive through Cloudflare Worker -> Cloud Run, where Host may be rewritten
    # to the upstream service domain. Strict MCP host validation causes false 421s in this setup.
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=False,
    )


def _json_no_cache(payload: dict[str, Any], status_code: int = 200) -> JSONResponse:
    return JSONResponse(payload, status_code=status_code, headers={"Cache-Control": "no-store, no-cache"})



def _oauth_error(error: str, error_description: str, status_code: int = 400) -> JSONResponse:
    return _json_no_cache(
        {
            "error": error,
            "error_description": error_description,
        },
        status_code=status_code,
    )


def _parse_requested_scopes(raw_scope: str | None) -> list[str]:
    requested = [scope.strip() for scope in str(raw_scope or "").split(" ") if scope.strip()]
    return requested or ["mcp"]


@dataclass(frozen=True)
class McpRequestContext:
    user_id: str
    project_id: str


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


def _resolve_collection_for_context(context: McpRequestContext, collection_ref: str) -> dict[str, Any] | None:
    ref = str(collection_ref or "").strip()
    if not ref:
        return None

    try:
        direct = collections_service.get_by_id(ref)
        if str(direct.get("projectId") or "") == context.project_id:
            return direct
    except HTTPException:
        pass

    lowered = ref.lower()
    for collection in collections_service.list_project_collections(context.project_id):
        slug = str(collection.get("slug") or "").lower()
        name = str(collection.get("name") or "").strip().lower()
        if lowered == slug or lowered == name:
            return collection
    return None


def _normalized_collection_name(value: str) -> str:
    return " ".join(str(value or "").strip().lower().split())


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


def _get_project_context_payload(project_id: str) -> dict[str, Any]:
    project = projects_service.get_by_id(project_id)
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


def _get_project_paper(paper_id: str, project_id: str) -> dict[str, Any] | None:
    paper = papers_service.get_by_id(paper_id)
    if not paper or str(paper.get("projectId") or "") != project_id:
        return None
    return paper


@lru_cache(maxsize=1)
def _build_mcp_server() -> FastMCP:
    server = FastMCP(
            name="whitepapper",
            instructions="""
You are a content editor connected to a Whitepapper CMS project.
Whitepapper is a markdown-first CMS. All content is written in markdown.

## Session startup — do this exactly once
1. Call get_project_context. Do not call it again unless the user explicitly asks to refresh.
2. Read project_description fully. It defines what the project is, who the audience is, and what tone to use.
3. Read content_guidelines if present. It contains explicit writing rules for this project.
4. Read every collection name and description. These define where content is routed.
5. Read existing paper titles to avoid creating duplicates.

## Routing rules — where to put content
- Match content to a collection by reading the collection description.
- Prefer existing collections first. Treat collection names case-insensitively and trim whitespace before deciding a collection is missing.
- Use get_collection to resolve by id/slug/name before attempting create_collection.
- If the content clearly fits an existing collection, use that collection_id.
- If no collection fits, call create_collection first with a one-sentence description, then create the paper inside it.
- Standalone papers (no collection_id) are for project-root content only: changelog, index page, overview, landing copy.
- Never guess a collection_id. Always derive it from get_project_context output.

## Writing rules — all content
- All paper body content is markdown. Use proper markdown: headers, code blocks, lists, bold, links.
- Never write placeholder content. If you do not have enough information to write a section, ask the user before creating.
- Do not truncate. Write the full content in one create_paper or update_paper call.
- Titles should be clear and descriptive, not clever.

## SEO rules — always fill these
- seo_title: maximum 60 characters. Must contain the primary keyword. Do not truncate the title with ellipsis.
- seo_description: maximum 155 characters. One to two sentences. Describes the page for search engines. No clickbait.
- slug: lowercase, hyphen-separated, no special characters, derived from the title. Example: "getting-started-with-payments-api".

## Efficiency rules — do not waste tool calls
- Call get_project_context exactly once per session.
- Call get_paper only when you need the full markdown body of a specific paper. Do not call it to check existence.
- When creating multiple papers in the same collection, create the collection once then batch the paper creates.
- Never call create_collection more than once for the same normalized name in a session.
- Do not call update_paper immediately after create_paper unless the user asks for a change.
- Do not confirm each action with the user unless they ask for confirmation mode.

## Error handling rules
- If create_paper returns slug_taken, generate a new unique slug and retry once.
- If create_paper returns collection_not_found, call get_project_context again to refresh, then retry.
- If create_collection is called for an existing normalized name, treat the returned collection as success and continue without retrying create_collection.
- If create_collection fails (for example already_exists or limit_reached), do not retry blindly. Refresh context once, select an existing matching collection if present, or report the blocker.
- If get_paper returns not_found, do not retry. Tell the user the paper does not exist.
- Never invent a project_id, paper_id, or collection_id. All IDs come from tool responses only.
""",
            token_verifier=mcp_token_verifier,
            auth=_mcp_auth_settings(),
            transport_security=_mcp_transport_security_settings(),
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

    def _normalize_metadata_payload_for_paper(paper: dict, metadata: dict[str, Any]) -> dict:
        generated = papers_service.generate_metadata_preview(paper)
        merged = {**generated, **metadata}
        # Keep MCP metadata contract aligned with the browser editor schema.
        return PaperMetadata.model_validate(merged).model_dump(mode="json")

    @server.resource(
            uri="whitepapper://project/context",
            name="Project Context",
            description="Full project structure including description, content guidelines, collections, and paper list. Read this before writing any content.",
            mime_type="application/json",
        )
    def project_context_resource() -> dict[str, Any]:
        import json
        context = _require_tool_context()
        project = projects_service.get_by_id(context.project_id)
        collections = collections_service.list_project_collections(context.project_id)
        collection_payload = []
        for collection in collections:
            collection_id = str(collection.get("collectionId") or "")
            papers = papers_service.list_by_collection_id(collection_id)
            collection_payload.append({
                "id": collection_id,
                "name": collection.get("name"),
                "description": collection.get("description") or "",
                "papers": [
                    {"id": p.get("paperId"), "slug": p.get("slug"), "title": p.get("title")}
                    for p in papers
                ],
            })
        standalone_papers = papers_service.list_by_project_id(context.project_id, standalone=True)
        return json.dumps({
            "project_id": context.project_id,
            "project_name": project.get("name"),
            "project_description": project.get("description") or "",
            "content_guidelines": project.get("contentGuidelines") or "",
            "collections": collection_payload,
            "standalone_papers": [
                {"id": p.get("paperId"), "slug": p.get("slug"), "title": p.get("title")}
                for p in standalone_papers
            ],
        })

    @server.tool(description="""
Call this ONCE at the start of every session before any other tool.
Returns the complete project structure: project description, content guidelines,
all collections with descriptions, all paper titles per collection, and standalone papers.
Use the collection descriptions to decide where new content belongs.
Use existing paper titles to avoid duplicates.
Do not call this again mid-session unless the user says the project structure has changed.
""")
    def get_project_context() -> dict[str, Any]:
        context = _require_tool_context()
        return _get_project_context_payload(context.project_id)

    @server.tool(description="""
Get the current project details for this MCP session.
Use this when you need project fields before updating them.
""")
    def get_project() -> dict[str, Any]:
        context = _require_tool_context()
        project = projects_service.get_by_id(context.project_id)
        return _project_payload(project)

    @server.tool(description="""
Update project fields (same behavior as browser project settings).
Only pass fields you want to change.
""")
    def update_project(
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        content_guidelines: str | None = None,
        logo_url: str | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()
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

        updated = projects_service.update(context.project_id, payload) if payload else projects_service.get_by_id(context.project_id)
        return _project_payload(updated)

    @server.tool(description="""
Set project visibility (same behavior as browser toggle and propagation).
""")
    def set_project_visibility(is_public: bool) -> dict[str, Any]:
        context = _require_tool_context()
        updated = projects_service.set_visibility(context.project_id, is_public)
        return _project_payload(updated)

    @server.tool(description="""
Delete the current project (same behavior as browser delete).
Set confirm=true to execute the deletion.
""")
    def delete_project(confirm: bool = False) -> dict[str, Any]:
        context = _require_tool_context()
        if not confirm:
            return {"error": "confirm_required", "message": "Set confirm=true to delete this project."}
        projects_service.delete(context.project_id)
        return {"deleted": True}

    @server.tool(description="""
Fetch the full markdown body and SEO fields of one paper.
Only call this when you need to read or edit the actual content of a paper.
Do not call this just to check if a paper exists — use the paper list from get_project_context for that.
paper_id comes from the papers array in get_project_context output.
""")
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
            "metadata": paper.get("metadata") or None,
            "seo": _paper_seo(paper),
        }

    @server.tool(description="""
Create a new paper in the project.
collection_id is optional. Omit it only for standalone root-level content like changelog or overview pages.
For all other content, always supply the collection_id from get_project_context output.
Always supply seo_title (max 60 chars, contains primary keyword) and seo_description (max 155 chars).
slug must be unique within the project. Check existing slugs in get_project_context before creating.
slug format: lowercase, hyphen-separated, no special characters. Example: "quickstart-nodejs".
If create returns slug_taken, append a short qualifier to the slug and retry once.
""")
    def create_paper(
        title: str,
        slug: str,
        markdown: str,
        collection_id: str | None = None,
        seo_title: str | None = None,
        seo_description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()

        normalized_slug = normalize_slug(slug)
        if not normalized_slug:
            return {"error": "invalid_slug", "message": "Slug is invalid."}

        if not papers_service.is_slug_available(context.user_id, normalized_slug):
            return {"error": "slug_taken", "message": "A paper with this slug already exists"}

        resolved_collection_id: str | None = None
        if collection_id:
            collection = _resolve_collection_for_context(context, collection_id)
            if not collection:
                return {"error": "collection_not_found"}
            resolved_collection_id = str(collection.get("collectionId") or "")
        created = papers_service.create(
            context.user_id,
            {
                "projectId": context.project_id,
                "collectionId": resolved_collection_id,
                "title": title,
                "slug": normalized_slug,
                "body": markdown or "",
            },
        )
        paper_id = str(created.get("paperId") or "")
        paper = papers_service.get_by_id(paper_id)
        if paper:
            next_metadata: dict[str, Any] | None = None
            try:
                if metadata is not None:
                    next_metadata = _normalize_metadata_payload_for_paper(paper, metadata)
                elif seo_title is not None or seo_description is not None:
                    next_metadata = _build_metadata_for_paper(
                        paper,
                        seo_title=seo_title or title,
                        seo_description=seo_description,
                    )
            except ValidationError as exc:
                return {"error": "invalid_metadata", "message": str(exc)}

            if next_metadata is not None:
                papers_service.update(paper_id, {"metadata": next_metadata})
                paper = papers_service.get_by_id(paper_id)

        return {
            "id": paper_id,
            "slug": normalized_slug,
            "metadata": (paper or {}).get("metadata") if paper else None,
            "seo": _paper_seo(paper),
        }

    @server.tool(description="""
Update an existing paper. Only pass fields you want to change. Unpassed fields are not touched.
Use this to rewrite content, fix SEO fields, or update the title.
paper_id comes from get_project_context or a previous create_paper response.
Do not call this immediately after create_paper unless changes are needed.
""")
    def update_paper(
        paper_id: str,
        title: str | None = None,
        slug: str | None = None,
        markdown: str | None = None,
        collection_id: str | None = None,
        status: str | None = None,
        seo_title: str | None = None,
        seo_description: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()
        paper = _get_project_paper(paper_id, context.project_id)
        if not paper:
            return {"error": "not_found"}

        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if slug is not None:
            normalized_slug = normalize_slug(slug)
            if not normalized_slug:
                return {"error": "invalid_slug", "message": "Slug is invalid."}
            if not papers_service.is_slug_available(context.user_id, normalized_slug, paper_id):
                return {"error": "slug_taken", "message": "A paper with this slug already exists"}
            payload["slug"] = normalized_slug
        if markdown is not None:
            payload["body"] = markdown
        if collection_id is not None:
            next_collection = str(collection_id).strip()
            if not next_collection:
                payload["collectionId"] = None
                payload["projectId"] = context.project_id
            else:
                resolved_collection = _resolve_collection_for_context(context, next_collection)
                if not resolved_collection:
                    return {"error": "collection_not_found"}
                payload["collectionId"] = str(resolved_collection.get("collectionId") or "")
                payload["projectId"] = context.project_id
        if status is not None:
            normalized_status = str(status).strip().lower()
            if normalized_status not in {"draft", "published", "archived"}:
                return {"error": "invalid_status", "message": "Allowed values: draft, published, archived."}
            payload["status"] = normalized_status

        if payload:
            papers_service.update(paper_id, payload)
            paper = papers_service.get_by_id(paper_id)

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
                papers_service.update(paper_id, {"metadata": next_metadata})
                paper = papers_service.get_by_id(paper_id)

        return {
            "updated": True,
            "id": paper_id,
            "slug": (paper or {}).get("slug"),
            "metadata": (paper or {}).get("metadata") if paper else None,
            "seo": _paper_seo(paper),
        }

    @server.tool(description="""
Permanently delete a paper. Cannot be undone.
Only call this if the user explicitly asks to delete a specific paper.
Returns the deleted paper title for confirmation.
""")
    def delete_paper(paper_id: str) -> dict[str, Any]:
        context = _require_tool_context()
        paper = _get_project_paper(paper_id, context.project_id)
        if not paper:
            return {"error": "not_found"}
        title = str(paper.get("title") or "")
        papers_service.delete(paper_id)
        return {"deleted": True, "title": title}

    @server.tool(description="""
Overwrite the project description. This is the main context document for the project.
It defines what the project is, who the audience is, tone, and content goals.
Call this when the user asks to update or rewrite the project description.
Write in markdown. Be specific — agents use this document to understand how to write for this project.
""")
    def update_project_description(markdown: str) -> dict[str, Any]:
        context = _require_tool_context()
        updated = projects_service.update(context.project_id, {"description": markdown})
        return _project_payload(updated)

    @server.tool(description="""
Create a new collection before creating papers that belong in it.
description is required. Write exactly one sentence that answers:
"What kind of content belongs in this collection?"
Examples of good descriptions:
- "Step-by-step tutorials for common integration patterns."
- "Technical reference for every API endpoint and parameter."
- "Answers to common questions from new users."
Bad descriptions: "Docs", "Content", "Misc", or anything vague.
After creating a collection, use the returned id as collection_id in create_paper calls.
""")
    def create_collection(
        name: str,
        description: str = "",
        slug: str | None = None,
        is_public: bool | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()
        clean_description = description.strip()
        if not clean_description:
            return {
                "error": "description_required",
                "message": "Provide a one-sentence description of what content belongs in this collection.",
            }

        normalized_name = _normalized_collection_name(name)
        for existing in collections_service.list_project_collections(context.project_id):
            if _normalized_collection_name(str(existing.get("name") or "")) == normalized_name:
                return _collection_payload(existing)

        payload: dict[str, Any] = {
            "projectId": context.project_id,
            "name": name,
            "description": clean_description,
        }
        if slug is not None:
            payload["slug"] = slug
        if is_public is not None:
            payload["isPublic"] = is_public
        created = collections_service.create(
            context.user_id,
            payload,
        )
        return _collection_payload(created)

    @server.tool(description="""
Get one collection by id, slug, or exact name in the current project.
""")
    def get_collection(collection_id: str) -> dict[str, Any]:
        context = _require_tool_context()
        collection = _resolve_collection_for_context(context, collection_id)
        if not collection:
            return {"error": "not_found"}
        return _collection_payload(collection)

    @server.tool(description="""
Update a collection name or description.
Use this to improve a vague collection description that was set previously.
Only pass fields you want to change.
""")
    def update_collection(
        collection_id: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        is_public: bool | None = None,
    ) -> dict[str, Any]:
        context = _require_tool_context()
        collection = _resolve_collection_for_context(context, collection_id)
        if not collection:
            return {"error": "not_found"}
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        resolved_id = str(collection.get("collectionId") or "")
        updated = collections_service.update(resolved_id, payload) if payload else collection
        if is_public is not None:
            updated = collections_service.set_visibility(resolved_id, is_public)
        return _collection_payload(updated)

    @server.tool(description="""
Set collection visibility (same behavior as browser toggle and propagation).
""")
    def set_collection_visibility(collection_id: str, is_public: bool) -> dict[str, Any]:
        context = _require_tool_context()
        collection = _resolve_collection_for_context(context, collection_id)
        if not collection:
            return {"error": "not_found"}
        updated = collections_service.set_visibility(str(collection.get("collectionId") or ""), is_public)
        return _collection_payload(updated)

    @server.tool(description="""
Delete a collection (same behavior as browser delete).
This also deletes all papers inside that collection.
""")
    def delete_collection(collection_id: str, confirm: bool = False) -> dict[str, Any]:
        context = _require_tool_context()
        if not confirm:
            return {"error": "confirm_required", "message": "Set confirm=true to delete this collection."}
        collection = _resolve_collection_for_context(context, collection_id)
        if not collection:
            return {"error": "not_found"}
        collections_service.delete(str(collection.get("collectionId") or ""))
        return {"deleted": True}

    return server


@lru_cache(maxsize=1)
def build_mcp_app():
    return _build_mcp_server().streamable_http_app()


def get_mcp_session_manager():
    return _build_mcp_server().session_manager


def build_mcp_router() -> APIRouter:
    router = APIRouter(tags=["mcp"])

    def _root_discovery_payload() -> dict[str, Any]:
        return _metadata_payload(issuer_url=get_public_api_url())

    def _mcp_discovery_payload() -> dict[str, Any]:
        # For path-scoped discovery aliases, issuer must include the resource path.
        return _metadata_payload(issuer_url=_mcp_url())

    @router.get("/.well-known/oauth-authorization-server")
    async def oauth_metadata() -> JSONResponse:
        return _json_no_cache(_root_discovery_payload())

    @router.get("/.well-known/oauth-protected-resource")
    async def protected_resource_metadata() -> JSONResponse:
        return _json_no_cache(_protected_resource_payload(resource_url=_mcp_http_endpoint_url()))

    @router.get("/.well-known/oauth-protected-resource/mcp")
    async def protected_resource_metadata_mcp_suffix() -> JSONResponse:
        return _json_no_cache(_protected_resource_payload(resource_url=_mcp_http_endpoint_url()))

    @router.get("/.well-known/openid-configuration")
    async def openid_metadata() -> JSONResponse:
        return _json_no_cache(_root_discovery_payload())

    @router.get("/.well-known/oauth-authorization-server/mcp")
    async def oauth_metadata_mcp_suffix() -> JSONResponse:
        return _json_no_cache(_mcp_discovery_payload())

    @router.get("/.well-known/openid-configuration/mcp")
    async def openid_metadata_mcp_suffix() -> JSONResponse:
        return _json_no_cache(_mcp_discovery_payload())

    mcp_router = APIRouter(prefix=MCP_HTTP_PREFIX)

    @mcp_router.get("/.well-known/oauth-authorization-server")
    async def oauth_metadata_mcp_prefix() -> JSONResponse:
        return _json_no_cache(_mcp_discovery_payload())

    @mcp_router.get("/.well-known/oauth-protected-resource")
    async def protected_resource_metadata_mcp_prefix() -> JSONResponse:
        return _json_no_cache(_protected_resource_payload(resource_url=_mcp_http_endpoint_url()))

    @mcp_router.get("/.well-known/openid-configuration")
    async def openid_metadata_mcp_prefix() -> JSONResponse:
        return _json_no_cache(_mcp_discovery_payload())

    @mcp_router.get("/config")
    async def get_mcp_connection_info() -> dict[str, Any]:
        return _mcp_connection_payload()

    @mcp_router.post("/register")
    async def register_client(request: Request) -> JSONResponse:
        try:
            payload = await request.json()
        except Exception:
            return _oauth_error("invalid_client_metadata", "Request body must be valid JSON.")

        if not isinstance(payload, dict):
            return _oauth_error("invalid_client_metadata", "Request body must be a JSON object.")

        redirect_uris_raw = payload.get("redirect_uris")
        if not isinstance(redirect_uris_raw, list):
            return _oauth_error("invalid_client_metadata", "redirect_uris must be an array.")

        try:
            client_info = mcp_oauth_service.register_client(
                client_name=str(payload.get("client_name") or "").strip() or None,
                redirect_uris=[str(item) for item in redirect_uris_raw],
                grant_types=[str(item) for item in payload.get("grant_types") or []] or None,
                token_endpoint_auth_method=(
                    str(payload.get("token_endpoint_auth_method") or "").strip()
                    or None
                ),
                response_types=[str(item) for item in payload.get("response_types") or []] or None,
                scope=str(payload.get("scope") or "").strip() or None,
            )
        except ValueError as exc:
            message = str(exc)
            error = "invalid_scope" if "scope" in message else "invalid_client_metadata"
            return _oauth_error(error, message)

        return _json_no_cache(client_info, status_code=201)

    @mcp_router.get("/authorize")
    async def authorize_get(request: Request):
        params = request.query_params
        response_type = str(params.get("response_type") or "").strip()
        client_id = str(params.get("client_id") or "").strip()
        redirect_uri = str(params.get("redirect_uri") or "").strip()
        state = str(params.get("state") or "").strip() or None
        code_challenge = str(params.get("code_challenge") or "").strip()
        code_challenge_method = str(params.get("code_challenge_method") or "").strip() or "S256"
        resource = str(params.get("resource") or "").strip() or None

        if response_type != "code":
            return _oauth_error("unsupported_response_type", "Only response_type=code is supported.")
        if not client_id:
            return _oauth_error("invalid_request", "client_id is required.")
        if not redirect_uri:
            return _oauth_error("invalid_request", "redirect_uri is required.")
        if not code_challenge:
            return _oauth_error("invalid_request", "code_challenge is required.")
        if code_challenge_method not in {"S256", "plain"}:
            return _oauth_error("invalid_request", "Supported code_challenge_method values: S256, plain.")

        try:
            redirect_to = mcp_oauth_service.create_authorization_request(
                client_id=client_id,
                redirect_uri=redirect_uri,
                state=state,
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method,
                scopes=_parse_requested_scopes(params.get("scope")),
                resource=resource,
            )
        except ValueError as exc:
            message = str(exc)
            error = "invalid_scope" if "scope" in message else "invalid_request"
            return _oauth_error(error, message)

        return RedirectResponse(url=redirect_to, status_code=302, headers={"Cache-Control": "no-store"})

    @mcp_router.post("/authorize")
    async def authorize_post(request: Request):
        form = await request.form()
        query_string = urlencode({key: str(value) for key, value in form.items()})
        redirected_request = Request(
            scope={**request.scope, "query_string": query_string.encode("utf-8"), "method": "GET"},
            receive=request.receive,
        )
        return await authorize_get(redirected_request)

    @mcp_router.post("/token")
    async def token_exchange(request: Request):
        form = await request.form()
        grant_type = str(form.get("grant_type") or "").strip()
        client_id = str(form.get("client_id") or "").strip()
        code = str(form.get("code") or "").strip()
        redirect_uri = str(form.get("redirect_uri") or "").strip()
        code_verifier = str(form.get("code_verifier") or "").strip()

        if grant_type != "authorization_code":
            return _oauth_error("unsupported_grant_type", "Only authorization_code is supported.")
        if not client_id:
            return _oauth_error("invalid_request", "client_id is required.")
        if not code:
            return _oauth_error("invalid_request", "code is required.")
        if not redirect_uri:
            return _oauth_error("invalid_request", "redirect_uri is required.")
        if not code_verifier:
            return _oauth_error("invalid_request", "code_verifier is required.")

        try:
            token = mcp_oauth_service.exchange_authorization_code(
                client_id=client_id,
                code=code,
                redirect_uri=redirect_uri,
                code_verifier=code_verifier,
            )
        except ValueError as exc:
            message = str(exc)
            error = "invalid_grant" if "code_verifier" in message or "Authorization code" in message else "invalid_request"
            return _oauth_error(error, message)

        return _json_no_cache(token.model_dump(exclude_none=True))

    @mcp_router.get("/oauth/request/{request_id}")
    async def get_oauth_request(request_id: str) -> dict[str, Any]:
        request_doc = mcp_oauth_service.get_pending_request(request_id)
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
            redirect_to = mcp_oauth_service.complete_authorization_request(
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
        mcp_oauth_service.cleanup_expired_oauth_data()
        return {"ok": True}

    router.include_router(mcp_router)
    return router
