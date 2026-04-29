from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from app.mcp.common import (
    assert_collection_project,
    current_mcp_userId,
    mcp_http_error,
    mutation_response,
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
    @server.tool(
        description=(
            "Cost: cheap. Use when: you need to move a paper between project-level and collection-level locations "
            "without manually coordinating projectId and collectionId."
        )
    )
    @tool_guard
    def move_paper(
        paperId: str,
        projectId: str | None = None,
        collectionId: str | None = None,
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_paper(userId, paperId)
        payload: dict[str, Any] = {}
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
        updated = papers_service.update(paperId, payload)
        return mutation_response("paper", updated, verbose=verbose)

    @server.tool(
        description="Cost: cheap. Use when: you only want to publish an existing paper. This is a thin convenience wrapper around update_paper."
    )
    @tool_guard
    def publish_paper(paperId: str, verbose: bool = False) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_paper(userId, paperId)
        updated = papers_service.update(paperId, {"status": "published"})
        return mutation_response("paper", updated, verbose=verbose)

    @server.tool(
        description=(
            "Cost: medium. Use when: you want create-or-update behavior keyed by slug. "
            "If a matching slug exists, it updates that paper. Otherwise it creates a new paper."
        )
    )
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
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        normalizedSlug = str(slug or "").strip()
        if not normalizedSlug:
            raise mcp_http_error(400, "VALIDATION_ERROR", "slug is required.")

        payload: dict[str, Any] = {"slug": normalizedSlug}
        if title is not None:
            payload["title"] = title
        if body is not None:
            payload["body"] = body
        if thumbnailUrl is not None:
            payload["thumbnailUrl"] = thumbnailUrl
        if status is not None:
            payload["status"] = normalize_status(status)
        if metadata is not None:
            payload["metadata"] = metadata

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
            updated = papers_service.update(str(existing.get("paperId") or ""), payload)
            return mutation_response("paper", updated, verbose=verbose)

        if "title" not in payload:
            payload["title"] = "Untitled Paper"
        created = papers_service.create(userId, payload)
        paper = papers_service.get_by_id(str(created.get("paperId") or ""))
        if not paper:
            raise mcp_http_error(500, "MCP_ERROR", "Paper was created but could not be loaded.")
        return mutation_response("paper", paper, verbose=verbose)

    @server.tool(
        description=(
            "Cost: cheap. Use when: creating a project. "
            "Returns a compact summary by default. Set verbose=true for the full project document."
        )
    )
    @tool_guard
    def create_project(
        name: str,
        slug: str | None = None,
        description: str | None = None,
        contentGuidelines: str | None = None,
        logoUrl: str | None = None,
        isPublic: bool | None = None,
        pagesNumber: int | None = None,
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        payload: dict[str, Any] = {"name": name}
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        if contentGuidelines is not None:
            payload["contentGuidelines"] = contentGuidelines
        if logoUrl is not None:
            payload["logoUrl"] = logoUrl
        if isPublic is not None:
            payload["isPublic"] = isPublic
        if pagesNumber is not None:
            payload["pagesNumber"] = pagesNumber
        created = projects_service.create(userId, payload)
        return mutation_response("project", created, verbose=verbose)

    @server.tool(
        description="Cost: cheap. Use when: updating a project you already resolved. Returns a compact summary by default."
    )
    @tool_guard
    def update_project(
        projectId: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        contentGuidelines: str | None = None,
        logoUrl: str | None = None,
        isPublic: bool | None = None,
        pagesNumber: int | None = None,
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_project(userId, projectId)
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        if contentGuidelines is not None:
            payload["contentGuidelines"] = contentGuidelines
        if logoUrl is not None:
            payload["logoUrl"] = logoUrl
        if isPublic is not None:
            payload["isPublic"] = isPublic
        if pagesNumber is not None:
            payload["pagesNumber"] = pagesNumber
        updated = projects_service.update(projectId, payload)
        return mutation_response("project", updated, verbose=verbose)

    @server.tool(
        description="Cost: cheap. Use when: permanently deleting a project. Set confirm=true to execute. The MCP layer returns a small structured result."
    )
    @tool_guard
    def delete_project(projectId: str, confirm: bool = False) -> dict[str, Any]:
        userId = current_mcp_userId()
        project = owned_project(userId, projectId)
        if not confirm:
            return {"ok": False, "code": "CONFIRM_REQUIRED", "message": "Set confirm=true to delete this project."}
        projects_service.delete(projectId)
        return {"ok": True, "deleted": mutation_response("project", project, verbose=False)}

    @server.tool(
        description="Cost: cheap. Use when: creating a collection inside a known project. Returns a compact summary by default."
    )
    @tool_guard
    def create_collection(
        projectId: str,
        name: str,
        description: str | None = None,
        slug: str | None = None,
        isPublic: bool | None = None,
        pagesNumber: int | None = None,
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_project(userId, projectId)
        payload: dict[str, Any] = {"projectId": projectId, "name": name}
        if description is not None:
            payload["description"] = description
        if slug is not None:
            payload["slug"] = slug
        if isPublic is not None:
            payload["isPublic"] = isPublic
        if pagesNumber is not None:
            payload["pagesNumber"] = pagesNumber
        created = collections_service.create(userId, payload)
        return mutation_response("collection", created, verbose=verbose)

    @server.tool(
        description="Cost: cheap. Use when: updating an existing collection. Returns a compact summary by default."
    )
    @tool_guard
    def update_collection(
        collectionId: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        isPublic: bool | None = None,
        pagesNumber: int | None = None,
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_collection(userId, collectionId)
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        if isPublic is not None:
            payload["isPublic"] = isPublic
        if pagesNumber is not None:
            payload["pagesNumber"] = pagesNumber
        updated = collections_service.update(collectionId, payload)
        return mutation_response("collection", updated, verbose=verbose)

    @server.tool(
        description="Cost: cheap. Use when: permanently deleting a collection. Set confirm=true to execute."
    )
    @tool_guard
    def delete_collection(collectionId: str, confirm: bool = False) -> dict[str, Any]:
        userId = current_mcp_userId()
        collection = owned_collection(userId, collectionId)
        if not confirm:
            return {"ok": False, "code": "CONFIRM_REQUIRED", "message": "Set confirm=true to delete this collection."}
        collections_service.delete(collectionId)
        return {"ok": True, "deleted": mutation_response("collection", collection, verbose=False)}

    @server.tool(
        description=(
            "Cost: cheap to medium. Use when: creating a paper. "
            "Returns a compact summary by default. Pass collectionId to place the paper inside a collection."
        )
    )
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
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        payload: dict[str, Any] = {"title": title}
        if slug is not None:
            payload["slug"] = slug
        if body is not None:
            payload["body"] = body
        if projectId is not None:
            owned_project(userId, projectId)
            payload["projectId"] = projectId
        if collectionId is not None:
            collection = owned_collection(userId, collectionId)
            assert_collection_project(collection, projectId)
            payload["collectionId"] = collectionId
        if thumbnailUrl is not None:
            payload["thumbnailUrl"] = thumbnailUrl
        if status is not None:
            payload["status"] = normalize_status(status)
        if metadata is not None:
            payload["metadata"] = metadata
        created = papers_service.create(userId, payload)
        paper = papers_service.get_by_id(str(created.get("paperId") or ""))
        if not paper:
            raise mcp_http_error(500, "MCP_ERROR", "Paper was created but could not be loaded.")
        return mutation_response("paper", paper, verbose=verbose)

    @server.tool(
        description="Cost: cheap to medium. Use when: updating one existing paper. Returns a compact summary by default."
    )
    @tool_guard
    def update_paper(
        paperId: str,
        title: str | None = None,
        slug: str | None = None,
        body: str | None = None,
        collectionId: str | None = None,
        projectId: str | None = None,
        thumbnailUrl: str | None = None,
        status: str | None = None,
        metadata: dict[str, Any] | None = None,
        verbose: bool = False,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_paper(userId, paperId)
        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if slug is not None:
            payload["slug"] = slug
        if body is not None:
            payload["body"] = body
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
        if thumbnailUrl is not None:
            payload["thumbnailUrl"] = thumbnailUrl
        if status is not None:
            payload["status"] = normalize_status(status)
        if metadata is not None:
            payload["metadata"] = metadata
        updated = papers_service.update(paperId, payload)
        return mutation_response("paper", updated, verbose=verbose)

    @server.tool(description="Cost: cheap. Use when: permanently deleting a paper. Set confirm=true to execute.")
    @tool_guard
    def delete_paper(paperId: str, confirm: bool = False) -> dict[str, Any]:
        userId = current_mcp_userId()
        paper = owned_paper(userId, paperId)
        if not confirm:
            return {"ok": False, "code": "CONFIRM_REQUIRED", "message": "Set confirm=true to delete this paper."}
        papers_service.delete(paperId)
        return {"ok": True, "deleted": mutation_response("paper", paper, verbose=False)}
