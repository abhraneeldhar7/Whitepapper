from __future__ import annotations

from functools import wraps
from typing import Any, Callable

from fastapi import HTTPException
from fastmcp.exceptions import AuthorizationError
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext
from mcp.types import ToolAnnotations

from app.core.firestore_store import firestore_store
from app.core.limits import MCP_TOKEN_LIMIT_PER_MONTH
from app.services.collections_service import collections_service
from app.services.mcp_auth import mcp_authorization_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.utils.pagination import normalize_limit as _pagination_normalize_limit

READ_ONLY = ToolAnnotations(readOnlyHint=True)


def current_mcp_userId() -> str:
    token = get_access_token()
    userId = str((token.claims if token else {}).get("sub") or "").strip()
    if not userId:
        raise AuthorizationError("Missing authenticated Whitepapper user.")
    return userId


class McpUsageMiddleware(Middleware):
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        userId = current_mcp_userId()
        mcp_authorization_service.get_user_usage(userId)
        usage_doc = firestore_store.get("mcp_usage", userId) or {"usage": 0}
        limit = int(usage_doc.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH))
        if int(usage_doc.get("usage", 0)) >= limit:
            raise AuthorizationError("Monthly MCP usage limit reached for this Whitepapper account.")
        firestore_store.increment("mcp_usage", userId, "usage", 1)
        result = await call_next(context)
        return result


def mcp_http_error(status_code: int, code: str, message: str, details: dict[str, Any] | None = None) -> HTTPException:
    payload: dict[str, Any] = {"code": code, "message": message}
    if details:
        payload["details"] = details
    return HTTPException(status_code=status_code, detail=payload)


def translate_http_exception(exc: HTTPException) -> HTTPException:
    detail = exc.detail
    if isinstance(detail, dict) and detail.get("code") and detail.get("message"):
        return exc

    message = str(detail or "Request failed.")
    status_code = int(exc.status_code or 500)
    lowered = message.lower()
    code = "MCP_ERROR"
    if status_code == 400:
        code = "AMBIGUOUS_SLUG" if "multiple" in lowered and "slug" in lowered else "VALIDATION_ERROR"
    elif status_code == 403:
        code = "PERMISSION_DENIED"
    elif status_code == 404:
        code = "NOT_FOUND"
    elif status_code == 409:
        code = "CONFLICT"
    elif status_code == 429:
        code = "RATE_LIMITED"
    return mcp_http_error(status_code, code, message)


def tool_guard(handler: Callable[..., Any]) -> Callable[..., Any]:
    @wraps(handler)
    def wrapped(*args, **kwargs):
        try:
            return handler(*args, **kwargs)
        except HTTPException as exc:
            raise translate_http_exception(exc) from exc

    return wrapped


def normalize_limit(limit: int) -> int:
    try:
        return _pagination_normalize_limit(limit)
    except Exception as exc:
        raise mcp_http_error(400, "VALIDATION_ERROR", "limit must be an integer between 1 and 100.") from exc


def normalize_status(status: str | None) -> str | None:
    if status is None:
        return None
    normalized = str(status).strip().lower()
    if normalized not in {"draft", "published", "archived"}:
        raise mcp_http_error(400, "VALIDATION_ERROR", "status must be draft, published, or archived.")
    return normalized


def apply_projection(
    doc: dict[str, Any],
    *,
    fields: list[str] | None = None,
    excludeFields: list[str] | None = None,
) -> dict[str, Any]:
    item = dict(doc)
    if fields:
        allowed = {field for field in fields if field}
        item = {key: value for key, value in item.items() if key in allowed}
    if excludeFields:
        excluded = {field for field in excludeFields if field}
        item = {key: value for key, value in item.items() if key not in excluded}
    return item


def project_paper(
    paper: dict[str, Any],
    *,
    includeBody: bool = False,
    includeMetadata: bool = True,
    fields: list[str] | None = None,
    excludeFields: list[str] | None = None,
) -> dict[str, Any]:
    item = dict(paper)
    if not includeBody:
        item.pop("body", None)
    if not includeMetadata:
        item.pop("metadata", None)
    return apply_projection(item, fields=fields, excludeFields=excludeFields)


def compact_project(project: dict[str, Any]) -> dict[str, Any]:
    return {
        "projectId": project.get("projectId"),
        "name": project.get("name"),
        "slug": project.get("slug"),
        "isPublic": project.get("isPublic"),
        "updatedAt": project.get("updatedAt"),
    }


def compact_collection(collection: dict[str, Any]) -> dict[str, Any]:
    return {
        "collectionId": collection.get("collectionId"),
        "projectId": collection.get("projectId"),
        "name": collection.get("name"),
        "slug": collection.get("slug"),
        "isPublic": collection.get("isPublic"),
        "updatedAt": collection.get("updatedAt"),
    }


def compact_paper(paper: dict[str, Any]) -> dict[str, Any]:
    return {
        "paperId": paper.get("paperId"),
        "projectId": paper.get("projectId"),
        "collectionId": paper.get("collectionId"),
        "title": paper.get("title"),
        "slug": paper.get("slug"),
        "status": paper.get("status"),
        "updatedAt": paper.get("updatedAt"),
    }


def owned_project(userId: str, projectId: str) -> dict[str, Any]:
    project = projects_service.get_by_id(projectId)
    if str(project.get("ownerId") or "") != userId:
        raise mcp_http_error(404, "NOT_FOUND", "Project not found.")
    return project


def owned_collection(userId: str, collectionId: str) -> dict[str, Any]:
    collection = collections_service.get_by_id(collectionId)
    if str(collection.get("ownerId") or "") != userId:
        raise mcp_http_error(404, "NOT_FOUND", "Collection not found.")
    return collection


def owned_paper(userId: str, paperId: str) -> dict[str, Any]:
    paper = papers_service.get_by_id(paperId)
    if not paper or str(paper.get("ownerId") or "") != userId:
        raise mcp_http_error(404, "NOT_FOUND", "Paper not found.")
    return paper


def find_owned_project_by_slug(userId: str, slug: str) -> dict[str, Any]:
    normalized = str(slug or "").strip().lower()
    if not normalized:
        raise mcp_http_error(400, "VALIDATION_ERROR", "projectSlug is required.")
    project = next(
        (item for item in projects_service.list_owned(userId) if str(item.get("slug") or "").strip().lower() == normalized),
        None,
    )
    if project is None:
        raise mcp_http_error(404, "NOT_FOUND", "Project not found.")
    return project


def find_owned_collection_by_slug(userId: str, collectionSlug: str, projectId: str | None = None) -> dict[str, Any]:
    normalized = str(collectionSlug or "").strip().lower()
    if not normalized:
        raise mcp_http_error(400, "VALIDATION_ERROR", "collectionSlug is required.")
    if projectId:
        candidate = collections_service.get_by_slug(projectId, normalized)
        if str(candidate.get("ownerId") or "") != userId:
            raise mcp_http_error(404, "NOT_FOUND", "Collection not found.")
        return candidate

    matches: list[dict[str, Any]] = []
    for project in projects_service.list_owned(userId):
        try:
            candidate = collections_service.get_by_slug(str(project.get("projectId") or ""), normalized)
        except HTTPException as exc:
            if exc.status_code == 404:
                continue
            raise
        if str(candidate.get("ownerId") or "") == userId:
            matches.append(candidate)

    if not matches:
        raise mcp_http_error(404, "NOT_FOUND", "Collection not found.")
    if len(matches) > 1:
        raise mcp_http_error(
            400,
            "AMBIGUOUS_SLUG",
            "Multiple collections use this slug. Pass projectId to resolve one collection.",
        )
    return matches[0]


def paged(items: list[dict[str, Any]], nextCursor: str | None) -> dict[str, Any]:
    return {"items": items, "nextCursor": nextCursor}


def assert_collection_project(collection: dict[str, Any], projectId: str | None) -> None:
    if projectId and str(collection.get("projectId") or "") != str(projectId):
        raise mcp_http_error(
            400,
            "VALIDATION_ERROR",
            "collectionId does not belong to the provided projectId.",
        )
