from __future__ import annotations

from functools import lru_cache
from typing import Any

from fastapi import HTTPException
from fastmcp import FastMCP
from fastmcp.exceptions import AuthorizationError
from fastmcp.server.dependencies import get_access_token
from fastmcp.server.middleware import Middleware, MiddlewareContext
from mcp.types import ToolAnnotations

from app.services.collections_service import collections_service
from app.services.mcp_auth import mcp_authorization_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service


def _current_mcp_user_id() -> str:
    token = get_access_token()
    user_id = str((token.claims if token else {}).get("sub") or "").strip()
    if not user_id:
        raise AuthorizationError("Missing authenticated Whitepapper user.")
    return user_id


class McpUsageMiddleware(Middleware):
    async def on_call_tool(self, context: MiddlewareContext, call_next):
        user_id = _current_mcp_user_id()
        if not mcp_authorization_service.is_user_usage_within_limit(user_id):
            raise AuthorizationError("Monthly MCP usage limit reached for this Whitepapper account.")
        result = await call_next(context)
        mcp_authorization_service.increment_user_usage(user_id)
        return result


@lru_cache(maxsize=1)
def _build_mcp_server() -> FastMCP:
    server = FastMCP(
        name="whitepapper",
        instructions="""
You are connected to Whitepapper at the account level.
Use these tools as building blocks:
- Start with get_workspace_overview to understand the account.
- Use project, collection, and paper lookup tools before modifying anything.
- Prefer ID-based tools after discovery because IDs are exact.
- search_papers is for broad text lookup across titles, slugs, content, and metadata.

Important behavior:
- Tool results use the same field names as the app data model.
- Paper list results omit body to save tokens, but single paper reads include full body.
- Never guess IDs or slugs when a lookup tool can discover them first.
        """.strip(),
        middleware=[McpUsageMiddleware()],
    )

    read_only = ToolAnnotations(readOnlyHint=True)

    @server.tool(
        description=(
            "Get the top-level workspace view for the signed-in Whitepapper account. "
            "Returns all owned projects and standalone papers that are not inside collections. "
            "Use this first to discover the workspace before drilling into a specific project."
        ),
        annotations=read_only,
    )
    def get_workspace_overview() -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        projects = projects_service.list_owned(user_id)
        standalone_papers = papers_service.list_standalone(user_id)
        return {
            "projects": projects,
            "standalonePapers": [{k: v for k, v in paper.items() if k != "body"} for paper in standalone_papers],
        }

    @server.tool(
        description=(
            "Get one project by projectId. "
            "Returns the full project object, standalone papers in that project, and the project's collections. "
            "Use this when you already know the exact projectId."
        ),
        annotations=read_only,
    )
    def get_project_by_id(project_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = projects_service.get_by_id(project_id)
        if str(project.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Project not found.")

        return {
            "project": project,
            "standalonePapers": [
                {k: v for k, v in paper.items() if k != "body"}
                for paper in papers_service.list_by_project_id(project_id, standalone=True)
                if str(paper.get("ownerId") or "") == user_id
            ],
            "collections": [
                collection
                for collection in collections_service.list_project_collections(project_id)
                if str(collection.get("ownerId") or "") == user_id
            ],
        }

    @server.tool(
        description=(
            "Get one project by slug within the signed-in user's workspace. "
            "Returns the full project object, standalone papers in that project, and the project's collections. "
            "Use this when you know the project slug but not the projectId."
        ),
        annotations=read_only,
    )
    def get_project_by_slug(slug: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        normalized = str(slug or "").strip().lower()
        if not normalized:
            raise HTTPException(status_code=400, detail="slug is required.")

        project = next(
            (item for item in projects_service.list_owned(user_id) if str(item.get("slug") or "").strip().lower() == normalized),
            None,
        )
        if project is None:
            raise HTTPException(status_code=404, detail="Project not found.")

        project_id = str(project.get("projectId") or "")
        return {
            "project": project,
            "standalonePapers": [
                {k: v for k, v in paper.items() if k != "body"}
                for paper in papers_service.list_by_project_id(project_id, standalone=True)
                if str(paper.get("ownerId") or "") == user_id
            ],
            "collections": [
                collection
                for collection in collections_service.list_project_collections(project_id)
                if str(collection.get("ownerId") or "") == user_id
            ],
        }

    @server.tool(
        description=(
            "Get one paper by paperId. "
            "Returns the full original paper object including body and metadata. "
            "Use this when you need the exact current content before editing."
        ),
        annotations=read_only,
    )
    def get_paper_by_id(paper_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        paper = papers_service.get_by_id(paper_id)
        if not paper or str(paper.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Paper not found.")
        return paper

    @server.tool(
        description=(
            "Get one paper by slug within the signed-in user's workspace. "
            "Returns the full original paper object including body and metadata. "
            "Use this when you know the paper slug but not the paperId."
        ),
        annotations=read_only,
    )
    def get_paper_by_slug(slug: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        normalized = str(slug or "").strip()
        if not normalized:
            raise HTTPException(status_code=400, detail="slug is required.")

        paper = papers_service.find_by_slug(normalized, owner_id=user_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        return paper

    @server.tool(
        description=(
            "Get one collection by collectionId. "
            "Returns the full original collection object and the papers inside it. "
            "Collection paper results omit body to save tokens."
        ),
        annotations=read_only,
    )
    def get_collection_by_id(collection_id: str) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        collection = collections_service.get_by_id(collection_id)
        if str(collection.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Collection not found.")
        return {
            "collection": collection,
            "papers": [
                {k: v for k, v in paper.items() if k != "body"}
                for paper in papers_service.list_by_collection_id(collection_id)
                if str(paper.get("ownerId") or "") == user_id
            ],
        }

    @server.tool(
        description=(
            "Get one collection by slug within the signed-in user's workspace. "
            "Because collection slugs are unique per project, you may pass project_id to resolve exactly. "
            "If project_id is omitted and the same slug exists in multiple projects, this tool returns an error."
        ),
        annotations=read_only,
    )
    def get_collection_by_slug(slug: str, project_id: str | None = None) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        normalized = str(slug or "").strip().lower()
        if not normalized:
            raise HTTPException(status_code=400, detail="slug is required.")

        collection = None
        if project_id:
            candidate = collections_service.get_by_slug(project_id, normalized)
            if str(candidate.get("ownerId") or "") != user_id:
                raise HTTPException(status_code=404, detail="Collection not found.")
            collection = candidate
        else:
            matches: list[dict[str, Any]] = []
            for project in projects_service.list_owned(user_id):
                try:
                    project_collection = collections_service.get_by_slug(str(project.get("projectId") or ""), normalized)
                except HTTPException as exc:
                    if exc.status_code == 404:
                        continue
                    raise
                if str(project_collection.get("ownerId") or "") == user_id:
                    matches.append(project_collection)
            if not matches:
                raise HTTPException(status_code=404, detail="Collection not found.")
            if len(matches) > 1:
                raise HTTPException(
                    status_code=400,
                    detail="Multiple collections use this slug. Pass project_id to resolve one collection.",
                )
            collection = matches[0]

        collection_id = str(collection.get("collectionId") or "")
        return {
            "collection": collection,
            "papers": [
                {k: v for k, v in paper.items() if k != "body"}
                for paper in papers_service.list_by_collection_id(collection_id)
                if str(paper.get("ownerId") or "") == user_id
            ],
        }

    @server.tool(
        description=(
            "Search papers owned by the signed-in user. "
            "Matches across title, slug, body, and metadata. "
            "Optional filters narrow the search by projectId, collectionId, or status. "
            "Returns ranked paper results without body to keep responses compact."
        ),
        annotations=read_only,
    )
    def search_papers(
        query: str,
        project_id: str | None = None,
        collection_id: str | None = None,
        status: str | None = None,
        limit: int = 25,
    ) -> list[dict[str, Any]]:
        user_id = _current_mcp_user_id()
        papers = papers_service.search_owned(
            user_id,
            query,
            project_id=project_id,
            collection_id=collection_id,
            status=status,
            limit=limit,
        )
        return [{k: v for k, v in paper.items() if k != "body"} for paper in papers]

    @server.tool(
        description=(
            "Create a project. "
            "Pass the same fields used by the app service such as name, slug, description, contentGuidelines, logoUrl, and isPublic. "
            "Returns the full created project object."
        )
    )
    def create_project(
        name: str,
        slug: str | None = None,
        description: str | None = None,
        contentGuidelines: str | None = None,
        logoUrl: str | None = None,
        isPublic: bool | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
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
        return projects_service.create(user_id, payload)

    @server.tool(
        description=(
            "Update an existing project by projectId. "
            "Only pass fields that should change. "
            "Uses the same field names as the project service and returns the full updated project object."
        )
    )
    def update_project(
        project_id: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        contentGuidelines: str | None = None,
        logoUrl: str | None = None,
        isPublic: bool | None = None,
        pagesNumber: int | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = projects_service.get_by_id(project_id)
        if str(project.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Project not found.")
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
        return projects_service.update(project_id, payload)

    @server.tool(
        description=(
            "Delete a project permanently. "
            "Set confirm=true to execute the deletion. "
            "Uses the existing project service delete flow including owned collections and papers."
        )
    )
    def delete_project(project_id: str, confirm: bool = False) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = projects_service.get_by_id(project_id)
        if str(project.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Project not found.")
        if not confirm:
            return {"ok": False, "detail": "Set confirm=true to delete this project."}
        return projects_service.delete(project_id)

    @server.tool(
        description=(
            "Create a collection inside a project. "
            "Pass the same fields used by the collection service: projectId, name, description, slug, and isPublic. "
            "Returns the full created collection object."
        )
    )
    def create_collection(
        projectId: str,
        name: str,
        description: str | None = None,
        slug: str | None = None,
        isPublic: bool | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        project = projects_service.get_by_id(projectId)
        if str(project.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Project not found.")
        payload: dict[str, Any] = {"projectId": projectId, "name": name}
        if description is not None:
            payload["description"] = description
        if slug is not None:
            payload["slug"] = slug
        if isPublic is not None:
            payload["isPublic"] = isPublic
        return collections_service.create(user_id, payload)

    @server.tool(
        description=(
            "Update an existing collection by collectionId. "
            "Only pass fields that should change. "
            "Uses the same field names as the collection service and returns the full updated collection object."
        )
    )
    def update_collection(
        collection_id: str,
        name: str | None = None,
        slug: str | None = None,
        description: str | None = None,
        isPublic: bool | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        collection = collections_service.get_by_id(collection_id)
        if str(collection.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Collection not found.")
        payload: dict[str, Any] = {}
        if name is not None:
            payload["name"] = name
        if slug is not None:
            payload["slug"] = slug
        if description is not None:
            payload["description"] = description
        if isPublic is not None:
            payload["isPublic"] = isPublic
        return collections_service.update(collection_id, payload)

    @server.tool(
        description=(
            "Delete a collection permanently. "
            "Set confirm=true to execute the deletion. "
            "Uses the existing collection service delete flow including papers inside the collection."
        )
    )
    def delete_collection(collection_id: str, confirm: bool = False) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        collection = collections_service.get_by_id(collection_id)
        if str(collection.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if not confirm:
            return {"ok": False, "detail": "Set confirm=true to delete this collection."}
        return collections_service.delete(collection_id)

    @server.tool(
        description=(
            "Create a paper. "
            "Pass the same core paper fields the app uses such as title, slug, body, projectId, collectionId, thumbnailUrl, and status. "
            "Returns the full created paper object."
        )
    )
    def create_paper(
        title: str = "Untitled Paper",
        slug: str | None = None,
        body: str | None = None,
        projectId: str | None = None,
        collectionId: str | None = None,
        thumbnailUrl: str | None = None,
        status: str | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        payload: dict[str, Any] = {"title": title}
        if slug is not None:
            payload["slug"] = slug
        if body is not None:
            payload["body"] = body
        if projectId is not None:
            project = projects_service.get_by_id(projectId)
            if str(project.get("ownerId") or "") != user_id:
                raise HTTPException(status_code=404, detail="Project not found.")
            payload["projectId"] = projectId
        if collectionId is not None:
            collection = collections_service.get_by_id(collectionId)
            if str(collection.get("ownerId") or "") != user_id:
                raise HTTPException(status_code=404, detail="Collection not found.")
            payload["collectionId"] = collectionId
        if thumbnailUrl is not None:
            payload["thumbnailUrl"] = thumbnailUrl
        if status is not None:
            payload["status"] = status

        created = papers_service.create(user_id, payload)
        paper = papers_service.get_by_id(str(created.get("paperId") or ""))
        if not paper:
            raise HTTPException(status_code=500, detail="Paper was created but could not be loaded.")
        return paper

    @server.tool(
        description=(
            "Update an existing paper by paperId. "
            "Only pass fields that should change. "
            "Uses the same field names as the paper service and returns the full updated paper object."
        )
    )
    def update_paper(
        paper_id: str,
        title: str | None = None,
        slug: str | None = None,
        body: str | None = None,
        collectionId: str | None = None,
        projectId: str | None = None,
        thumbnailUrl: str | None = None,
        status: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        paper = papers_service.get_by_id(paper_id)
        if not paper or str(paper.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Paper not found.")

        payload: dict[str, Any] = {}
        if title is not None:
            payload["title"] = title
        if slug is not None:
            payload["slug"] = slug
        if body is not None:
            payload["body"] = body
        if collectionId is not None:
            if collectionId:
                collection = collections_service.get_by_id(collectionId)
                if str(collection.get("ownerId") or "") != user_id:
                    raise HTTPException(status_code=404, detail="Collection not found.")
                payload["collectionId"] = collectionId
                payload["projectId"] = collection.get("projectId")
            else:
                payload["collectionId"] = None
        if projectId is not None:
            if projectId:
                project = projects_service.get_by_id(projectId)
                if str(project.get("ownerId") or "") != user_id:
                    raise HTTPException(status_code=404, detail="Project not found.")
                payload["projectId"] = projectId
            else:
                payload["projectId"] = None
        if thumbnailUrl is not None:
            payload["thumbnailUrl"] = thumbnailUrl
        if status is not None:
            payload["status"] = status
        if metadata is not None:
            payload["metadata"] = metadata

        return papers_service.update(paper_id, payload)

    @server.tool(
        description=(
            "Delete a paper permanently. "
            "Set confirm=true to execute the deletion. "
            "Uses the existing paper service delete flow."
        )
    )
    def delete_paper(paper_id: str, confirm: bool = False) -> dict[str, Any]:
        user_id = _current_mcp_user_id()
        paper = papers_service.get_by_id(paper_id)
        if not paper or str(paper.get("ownerId") or "") != user_id:
            raise HTTPException(status_code=404, detail="Paper not found.")
        if not confirm:
            return {"ok": False, "detail": "Set confirm=true to delete this paper."}
        return papers_service.delete(paper_id)

    return server


@lru_cache(maxsize=1)
def build_mcp_app():
    return _build_mcp_server().http_app(path="/", transport="http", stateless_http=True)
