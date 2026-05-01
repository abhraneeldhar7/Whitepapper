from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from app.mcp.common import (
    assert_collection_project,
    current_mcp_userId,
    mcp_http_error,
    normalize_status,
    owned_collection,
    owned_paper,
    owned_project,
    tool_guard,
)
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service


def register_write_tools(server: FastMCP) -> None:
    @server.tool(description="Create a new project.")
    @tool_guard
    def create_project(
        name: str,
        slug: str | None = None,
        description: str | None = None,
        contentGuidelines: str | None = None,
        logoUrl: str | None = None,
        isPublic: bool | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        payload: dict[str, Any] = {"name": name}
        if slug is not None: payload["slug"] = slug
        if description is not None: payload["description"] = description
        if contentGuidelines is not None: payload["contentGuidelines"] = contentGuidelines
        if logoUrl is not None: payload["logoUrl"] = logoUrl
        if isPublic is not None: payload["isPublic"] = isPublic
        return projects_service.create(userId, payload)

    @server.tool(description="Update an existing project's fields.")
    @tool_guard
    def update_project(
        projectId: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        contentGuidelines: str | None = None,
        logoUrl: str | None = None,
        isPublic: bool | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_project(userId, projectId)
        payload: dict[str, Any] = {}
        if name is not None: payload["name"] = name
        if slug is not None: payload["slug"] = slug
        if description is not None: payload["description"] = description
        if contentGuidelines is not None: payload["contentGuidelines"] = contentGuidelines
        if logoUrl is not None: payload["logoUrl"] = logoUrl
        if isPublic is not None: payload["isPublic"] = isPublic
        return projects_service.update(projectId, payload)

    @server.tool(description="Permanently delete a project and all its content.")
    @tool_guard
    def delete_project(projectId: str) -> dict[str, Any]:
        owned_project(current_mcp_userId(), projectId)
        projects_service.delete(projectId)
        return {"ok": True}

    @server.tool(description="Create a new collection inside a project.")
    @tool_guard
    def create_collection(
        projectId: str,
        name: str,
        description: str | None = None,
        slug: str | None = None,
        isPublic: bool | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_project(userId, projectId)
        payload: dict[str, Any] = {"projectId": projectId, "name": name}
        if description is not None: payload["description"] = description
        if slug is not None: payload["slug"] = slug
        if isPublic is not None: payload["isPublic"] = isPublic
        return collections_service.create(userId, payload)

    @server.tool(description="Update an existing collection's fields.")
    @tool_guard
    def update_collection(
        collectionId: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        isPublic: bool | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_collection(userId, collectionId)
        payload: dict[str, Any] = {}
        if name is not None: payload["name"] = name
        if slug is not None: payload["slug"] = slug
        if description is not None: payload["description"] = description
        if isPublic is not None: payload["isPublic"] = isPublic
        return collections_service.update(collectionId, payload)

    @server.tool(description="Permanently delete a collection and all its papers.")
    @tool_guard
    def delete_collection(collectionId: str) -> dict[str, Any]:
        owned_collection(current_mcp_userId(), collectionId)
        collections_service.delete(collectionId)
        return {"ok": True}

    @server.tool(description="Create a new paper. Pass collectionId or projectId to place it.")
    @tool_guard
    def create_paper(
        title: str = "Untitled Paper",
        slug: str | None = None,
        body: str | None = None,
        projectId: str | None = None,
        collectionId: str | None = None,
        thumbnailUrl: str | None = None,
        status: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        payload: dict[str, Any] = {"title": title}
        if slug is not None: payload["slug"] = slug
        if body is not None: payload["body"] = body
        if projectId is not None:
            owned_project(userId, projectId)
            payload["projectId"] = projectId
        if collectionId is not None:
            collection = owned_collection(userId, collectionId)
            assert_collection_project(collection, projectId)
            payload["collectionId"] = collectionId
        if thumbnailUrl is not None: payload["thumbnailUrl"] = thumbnailUrl
        if status is not None: payload["status"] = normalize_status(status)
        if metadata is not None: payload["metadata"] = metadata
        created = papers_service.create(userId, payload)
        paper = papers_service.get_by_id(str(created.get("paperId") or ""))
        if not paper:
            raise mcp_http_error(500, "MCP_ERROR", "Paper was created but could not be loaded.")
        return paper

    @server.tool(description="Update an existing paper's fields. Also used to publish (status=published) or move (set projectId/collectionId).")
    @tool_guard
    def update_paper(
        paperId: str,
        title: str | None = None,
        slug: str | None = None,
        body: str | None = None,
        projectId: str | None = None,
        collectionId: str | None = None,
        thumbnailUrl: str | None = None,
        status: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_paper(userId, paperId)
        payload: dict[str, Any] = {}
        if title is not None: payload["title"] = title
        if slug is not None: payload["slug"] = slug
        if body is not None: payload["body"] = body
        if collectionId is not None:
            if collectionId:
                collection = owned_collection(userId, collectionId)
                assert_collection_project(collection, projectId)
                payload["collectionId"] = collectionId
                payload["projectId"] = collection.get("projectId")
            else:
                payload["collectionId"] = None
        if projectId is not None:
            if projectId:
                owned_project(userId, projectId)
                payload["projectId"] = projectId
            else:
                payload["projectId"] = None
        if thumbnailUrl is not None: payload["thumbnailUrl"] = thumbnailUrl
        if status is not None: payload["status"] = normalize_status(status)
        if metadata is not None: payload["metadata"] = metadata
        return papers_service.update(paperId, payload)

    @server.tool(description="Permanently delete a paper.")
    @tool_guard
    def delete_paper(paperId: str) -> dict[str, Any]:
        owned_paper(current_mcp_userId(), paperId)
        papers_service.delete(paperId)
        return {"ok": True}

    @server.tool(description="Create or update a paper keyed by slug. If the slug exists the paper is updated, otherwise a new paper is created.")
    @tool_guard
    def upsert_paper_by_slug(
        slug: str,
        title: str | None = None,
        body: str | None = None,
        projectId: str | None = None,
        collectionId: str | None = None,
        thumbnailUrl: str | None = None,
        status: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        normalizedSlug = str(slug or "").strip()
        if not normalizedSlug:
            raise mcp_http_error(400, "VALIDATION_ERROR", "slug is required.")

        payload: dict[str, Any] = {"slug": normalizedSlug}
        if title is not None: payload["title"] = title
        if body is not None: payload["body"] = body
        if thumbnailUrl is not None: payload["thumbnailUrl"] = thumbnailUrl
        if status is not None: payload["status"] = normalize_status(status)
        if metadata is not None: payload["metadata"] = metadata

        if collectionId is not None:
            if collectionId:
                collection = owned_collection(userId, collectionId)
                assert_collection_project(collection, projectId)
                payload["collectionId"] = collectionId
                payload["projectId"] = collection.get("projectId")
            else:
                payload["collectionId"] = None
        elif projectId is not None:
            if projectId:
                owned_project(userId, projectId)
                payload["projectId"] = projectId
            else:
                payload["projectId"] = None

        existing = papers_service.find_by_slug(normalizedSlug, ownerId=userId, projectId=projectId)
        if existing:
            return papers_service.update(str(existing.get("paperId") or ""), payload)

        if "title" not in payload:
            payload["title"] = "Untitled Paper"
        created = papers_service.create(userId, payload)
        paper = papers_service.get_by_id(str(created.get("paperId") or ""))
        if not paper:
            raise mcp_http_error(500, "MCP_ERROR", "Paper was created but could not be loaded.")
        return paper
