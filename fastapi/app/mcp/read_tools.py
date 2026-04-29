from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from app.mcp.common import (
    READ_ONLY,
    compact_collection,
    compact_paper,
    compact_project,
    current_mcp_userId,
    find_owned_collection_by_slug,
    find_owned_project_by_slug,
    normalize_limit,
    normalize_status,
    owned_collection,
    owned_paper,
    owned_project,
    paged,
    project_collection,
    project_paper,
    project_project,
    tool_guard,
    assert_collection_project,
    mcp_http_error,
)
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service


def register_read_tools(server: FastMCP) -> None:
    @server.tool(
        description=(
            "Cost: cheap. Use when: first account-level discovery. "
            "Returns paginated project and standalone-paper summaries for the signed-in workspace. "
            "Use projectFields and paperFields to keep payloads tight."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_workspace_overview(
        projectLimit: int = 25,
        projectCursor: str | None = None,
        standalonePaperLimit: int = 25,
        standalonePaperCursor: str | None = None,
        projectFields: list[str] | None = None,
        projectExcludeFields: list[str] | None = None,
        paperFields: list[str] | None = None,
        paperExcludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        projects_page = projects_service.list_owned_paginated(userId, limit=normalize_limit(projectLimit), cursor=projectCursor)
        papers_page = papers_service.list_standalone_paginated(
            userId,
            limit=normalize_limit(standalonePaperLimit),
            cursor=standalonePaperCursor,
        )
        return {
            "projects": [
                project_project(project, fields=projectFields, excludeFields=projectExcludeFields)
                for project in projects_page["items"]
            ],
            "projectsNextCursor": projects_page["nextCursor"],
            "standalonePapers": [
                project_paper(paper, fields=paperFields, excludeFields=paperExcludeFields)
                for paper in papers_page["items"]
            ],
            "standalonePapersNextCursor": papers_page["nextCursor"],
        }

    @server.tool(
        description=(
            "Cost: cheap. Use when: you need a compact paginated list of owned projects. "
            "Prefer this before get_project_by_id when browsing."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def list_projects(
        limit: int = 25,
        cursor: str | None = None,
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        page = projects_service.list_owned_paginated(userId, limit=normalize_limit(limit), cursor=cursor)
        return paged(
            [project_project(project, fields=fields, excludeFields=excludeFields) for project in page["items"]],
            page["nextCursor"],
        )

    @server.tool(
        description=(
            "Cost: cheap. Use when: you need collections for one project without loading the whole project view. "
            "Returns paginated collection summaries."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def list_collections(
        projectId: str,
        limit: int = 25,
        cursor: str | None = None,
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        owned_project(userId, projectId)
        page = collections_service.list_project_collections_paginated(projectId, limit=normalize_limit(limit), cursor=cursor)
        return paged(
            [project_collection(collection, fields=fields, excludeFields=excludeFields) for collection in page["items"]],
            page["nextCursor"],
        )

    @server.tool(
        description=(
            "Cost: cheap to medium. Use when: you need a paginated paper list. "
            "Set collectionId or projectId to narrow scope. body is omitted unless includeBody=true."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def list_papers(
        projectId: str | None = None,
        collectionId: str | None = None,
        standalone: bool = False,
        status: str | None = None,
        limit: int = 25,
        cursor: str | None = None,
        includeBody: bool = False,
        includeMetadata: bool = True,
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        normalized_status = normalize_status(status)

        if collectionId:
            collection = owned_collection(userId, collectionId)
            assert_collection_project(collection, projectId)
            page = papers_service.list_by_collectionId_paginated(
                collectionId,
                status=normalized_status,
                limit=normalize_limit(limit),
                cursor=cursor,
            )
        elif projectId:
            owned_project(userId, projectId)
            page = papers_service.list_owned_filtered_paginated(
                ownerId=userId,
                projectId=projectId,
                standalone=standalone,
                status=normalized_status,
                limit=normalize_limit(limit),
                cursor=cursor,
            )
        else:
            page = papers_service.list_owned_filtered_paginated(
                ownerId=userId,
                standalone=standalone,
                status=normalized_status,
                limit=normalize_limit(limit),
                cursor=cursor,
            )

        return paged(
            [
                project_paper(
                    paper,
                    includeBody=includeBody,
                    includeMetadata=includeMetadata,
                    fields=fields,
                    excludeFields=excludeFields,
                )
                for paper in page["items"]
            ],
            page["nextCursor"],
        )

    @server.tool(
        description=(
            "Cost: medium. Use when: you need one exact project by projectId. "
            "Avoid when browsing; list_projects is cheaper. Optional include flags let you skip child lists."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_project_by_id(
        projectId: str,
        includeStandalonePapers: bool = True,
        includeCollections: bool = True,
        standalonePaperLimit: int = 25,
        standalonePaperCursor: str | None = None,
        collectionLimit: int = 25,
        collectionCursor: str | None = None,
        projectFields: list[str] | None = None,
        projectExcludeFields: list[str] | None = None,
        paperFields: list[str] | None = None,
        paperExcludeFields: list[str] | None = None,
        collectionFields: list[str] | None = None,
        collectionExcludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        project = owned_project(userId, projectId)
        result: dict[str, Any] = {"project": project_project(project, fields=projectFields, excludeFields=projectExcludeFields)}

        if includeStandalonePapers:
            papers_page = papers_service.list_owned_filtered_paginated(
                ownerId=userId,
                projectId=projectId,
                standalone=True,
                limit=normalize_limit(standalonePaperLimit),
                cursor=standalonePaperCursor,
            )
            result["standalonePapers"] = [
                project_paper(paper, fields=paperFields, excludeFields=paperExcludeFields)
                for paper in papers_page["items"]
            ]
            result["standalonePapersNextCursor"] = papers_page["nextCursor"]

        if includeCollections:
            collections_page = collections_service.list_project_collections_paginated(
                projectId,
                limit=normalize_limit(collectionLimit),
                cursor=collectionCursor,
            )
            result["collections"] = [
                project_collection(collection, fields=collectionFields, excludeFields=collectionExcludeFields)
                for collection in collections_page["items"]
            ]
            result["collectionsNextCursor"] = collections_page["nextCursor"]

        return result

    @server.tool(
        description=(
            "Cost: medium. Use when: you know the project slug but not projectId. "
            "Returns the same shape as get_project_by_id."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_project_by_slug(
        slug: str,
        includeStandalonePapers: bool = True,
        includeCollections: bool = True,
        standalonePaperLimit: int = 25,
        standalonePaperCursor: str | None = None,
        collectionLimit: int = 25,
        collectionCursor: str | None = None,
        projectFields: list[str] | None = None,
        projectExcludeFields: list[str] | None = None,
        paperFields: list[str] | None = None,
        paperExcludeFields: list[str] | None = None,
        collectionFields: list[str] | None = None,
        collectionExcludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        project = find_owned_project_by_slug(current_mcp_userId(), slug)
        return get_project_by_id(
            projectId=str(project.get("projectId") or ""),
            includeStandalonePapers=includeStandalonePapers,
            includeCollections=includeCollections,
            standalonePaperLimit=standalonePaperLimit,
            standalonePaperCursor=standalonePaperCursor,
            collectionLimit=collectionLimit,
            collectionCursor=collectionCursor,
            projectFields=projectFields,
            projectExcludeFields=projectExcludeFields,
            paperFields=paperFields,
            paperExcludeFields=paperExcludeFields,
            collectionFields=collectionFields,
            collectionExcludeFields=collectionExcludeFields,
        )

    @server.tool(
        description=(
            "Cost: medium. Use when: you need one exact collection and optionally a paginated paper list. "
            "Collection papers omit body unless includeBody=true."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_collection_by_id(
        collectionId: str,
        includePapers: bool = True,
        paperLimit: int = 25,
        paperCursor: str | None = None,
        includeBody: bool = False,
        includeMetadata: bool = True,
        collectionFields: list[str] | None = None,
        collectionExcludeFields: list[str] | None = None,
        paperFields: list[str] | None = None,
        paperExcludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        collection = owned_collection(userId, collectionId)
        result: dict[str, Any] = {"collection": project_collection(collection, fields=collectionFields, excludeFields=collectionExcludeFields)}
        if includePapers:
            page = papers_service.list_by_collectionId_paginated(collectionId, limit=normalize_limit(paperLimit), cursor=paperCursor)
            result["papers"] = [
                project_paper(
                    paper,
                    includeBody=includeBody,
                    includeMetadata=includeMetadata,
                    fields=paperFields,
                    excludeFields=paperExcludeFields,
                )
                for paper in page["items"]
            ]
            result["papersNextCursor"] = page["nextCursor"]
        return result

    @server.tool(
        description=(
            "Cost: medium. Use when: you know the collection slug but not collectionId. "
            "Pass projectId when possible because collection slugs are only unique inside a project."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_collection_by_slug(
        slug: str,
        projectId: str | None = None,
        includePapers: bool = True,
        paperLimit: int = 25,
        paperCursor: str | None = None,
        includeBody: bool = False,
        includeMetadata: bool = True,
        collectionFields: list[str] | None = None,
        collectionExcludeFields: list[str] | None = None,
        paperFields: list[str] | None = None,
        paperExcludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        collection = find_owned_collection_by_slug(current_mcp_userId(), slug, projectId=projectId)
        return get_collection_by_id(
            collectionId=str(collection.get("collectionId") or ""),
            includePapers=includePapers,
            paperLimit=paperLimit,
            paperCursor=paperCursor,
            includeBody=includeBody,
            includeMetadata=includeMetadata,
            collectionFields=collectionFields,
            collectionExcludeFields=collectionExcludeFields,
            paperFields=paperFields,
            paperExcludeFields=paperExcludeFields,
        )

    @server.tool(
        description=(
            "Cost: medium. Use when: you need the exact current paper, usually before editing. "
            "IMPORTANT: The paper title is rendered as an <h1> on the public page by the framework — "
            "do NOT add another <h1> inside the body content. The thumbnail and title/heading are "
            "displayed outside the content body area. Set includeBody=false if you only need "
            "metadata or routing fields."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_paper_by_id(
        paperId: str,
        includeBody: bool = True,
        includeMetadata: bool = True,
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        paper = owned_paper(current_mcp_userId(), paperId)
        return project_paper(paper, includeBody=includeBody, includeMetadata=includeMetadata, fields=fields, excludeFields=excludeFields)

    @server.tool(
        description=(
            "Cost: medium. Use when: you know the paper slug but not paperId. "
            "IMPORTANT: paper title is rendered as <h1> on the public page — do NOT add another <h1> in body. "
            "Thumbnail and heading are outside the content body. "
            "Pass projectId when the slug should resolve inside a specific project."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_paper_by_slug(
        slug: str,
        projectId: str | None = None,
        includeBody: bool = True,
        includeMetadata: bool = True,
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        normalized = str(slug or "").strip()
        if not normalized:
            raise mcp_http_error(400, "VALIDATION_ERROR", "slug is required.")
        paper = papers_service.find_by_slug(normalized, ownerId=userId, projectId=projectId)
        if not paper:
            raise mcp_http_error(404, "NOT_FOUND", "Paper not found.")
        return project_paper(paper, includeBody=includeBody, includeMetadata=includeMetadata, fields=fields, excludeFields=excludeFields)

    @server.tool(
        description=(
            "Cost: cheap to medium. Use when: you already have multiple exact paper IDs and want one batch read "
            "instead of calling get_paper_by_id repeatedly. "
            "Note: paper title is rendered as <h1> on the public page by the framework (outside body)."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_papers_by_ids(
        paperIds: list[str],
        includeBody: bool = False,
        includeMetadata: bool = True,
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        userId = current_mcp_userId()
        return [
            project_paper(paper, includeBody=includeBody, includeMetadata=includeMetadata, fields=fields, excludeFields=excludeFields)
            for paper in papers_service.get_many_by_ids(paperIds)
            if str(paper.get("ownerId") or "") == userId
        ]

    @server.tool(
        description="Cost: cheap. Use when: you already have multiple exact collection IDs and want a compact batch read.",
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_collections_by_ids(
        collectionIds: list[str],
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        userId = current_mcp_userId()
        return [
            project_collection(collection, fields=fields, excludeFields=excludeFields)
            for collection in collections_service.get_many_by_ids(collectionIds)
            if str(collection.get("ownerId") or "") == userId
        ]

    @server.tool(
        description=(
            "Cost: medium to expensive. Use when: you need one structured project tree in fewer calls. "
            "Leave includeCollectionPapers=false unless you truly need papers grouped by collection."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def get_project_content_tree(
        projectId: str,
        collectionLimit: int = 25,
        collectionCursor: str | None = None,
        standalonePaperLimit: int = 25,
        standalonePaperCursor: str | None = None,
        includeCollectionPapers: bool = False,
        paperLimitPerCollection: int = 10,
        projectFields: list[str] | None = None,
        projectExcludeFields: list[str] | None = None,
        collectionFields: list[str] | None = None,
        collectionExcludeFields: list[str] | None = None,
        paperFields: list[str] | None = None,
        paperExcludeFields: list[str] | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        project = owned_project(userId, projectId)
        collections_page = collections_service.list_project_collections_paginated(
            projectId,
            limit=normalize_limit(collectionLimit),
            cursor=collectionCursor,
        )
        standalone_page = papers_service.list_owned_filtered_paginated(
            ownerId=userId,
            projectId=projectId,
            standalone=True,
            limit=normalize_limit(standalonePaperLimit),
            cursor=standalonePaperCursor,
        )
        result: dict[str, Any] = {
            "project": project_project(project, fields=projectFields, excludeFields=projectExcludeFields),
            "collections": [
                project_collection(collection, fields=collectionFields, excludeFields=collectionExcludeFields)
                for collection in collections_page["items"]
            ],
            "collectionsNextCursor": collections_page["nextCursor"],
            "standalonePapers": [
                project_paper(paper, fields=paperFields, excludeFields=paperExcludeFields)
                for paper in standalone_page["items"]
            ],
            "standalonePapersNextCursor": standalone_page["nextCursor"],
        }
        if includeCollectionPapers:
            result["collectionPapers"] = [
                {
                    "collectionId": collection.get("collectionId"),
                    "papers": [
                        project_paper(paper, fields=paperFields, excludeFields=paperExcludeFields)
                        for paper in papers_service.list_by_collectionId_paginated(
                            str(collection.get("collectionId") or ""),
                            limit=normalize_limit(paperLimitPerCollection),
                        )["items"]
                    ],
                }
                for collection in collections_page["items"]
            ]
        return result

    @server.tool(
        description=(
            "Cost: medium. Use when: broad text lookup is the right first pass. "
            "Matches title, slug, body, and metadata. Returns ranked compact results."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def search_papers(
        query: str,
        projectId: str | None = None,
        collectionId: str | None = None,
        status: str | None = None,
        limit: int = 25,
        includeBody: bool = False,
        includeMetadata: bool = True,
        fields: list[str] | None = None,
        excludeFields: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        userId = current_mcp_userId()
        if projectId:
            owned_project(userId, projectId)
        if collectionId:
            collection = owned_collection(userId, collectionId)
            assert_collection_project(collection, projectId)
        papers = papers_service.search_owned(
            userId,
            query,
            projectId=projectId,
            collectionId=collectionId,
            status=normalize_status(status),
            limit=normalize_limit(limit),
        )
        return [
            project_paper(paper, includeBody=includeBody, includeMetadata=includeMetadata, fields=fields, excludeFields=excludeFields)
            for paper in papers
        ]

    @server.tool(
        description=(
            "Cost: cheap. Use when: you need to convert slugs into exact IDs before making follow-up calls. "
            "Pass projectId or projectSlug when resolving collection or paper slugs to avoid ambiguity."
        ),
        annotations=READ_ONLY,
    )
    @tool_guard
    def resolve_slug_to_id(
        projectSlug: str | None = None,
        collectionSlug: str | None = None,
        paperSlug: str | None = None,
        projectId: str | None = None,
    ) -> dict[str, Any]:
        userId = current_mcp_userId()
        resolved_project = owned_project(userId, projectId) if projectId else None
        if projectSlug:
            resolved_project = find_owned_project_by_slug(userId, projectSlug)
            projectId = str(resolved_project.get("projectId") or "")

        resolved_collection = None
        if collectionSlug:
            resolved_collection = find_owned_collection_by_slug(userId, collectionSlug, projectId=projectId)
            if not resolved_project and resolved_collection.get("projectId"):
                resolved_project = owned_project(userId, str(resolved_collection.get("projectId")))
                projectId = str(resolved_project.get("projectId") or "")

        resolved_paper = None
        if paperSlug:
            resolved_paper = papers_service.find_by_slug(paperSlug, ownerId=userId, projectId=projectId)
            if not resolved_paper:
                raise mcp_http_error(404, "NOT_FOUND", "Paper not found.")
            if not resolved_project and resolved_paper.get("projectId"):
                resolved_project = owned_project(userId, str(resolved_paper.get("projectId")))
            if not resolved_collection and resolved_paper.get("collectionId"):
                resolved_collection = owned_collection(userId, str(resolved_paper.get("collectionId")))

        return {
            "project": compact_project(resolved_project) if resolved_project else None,
            "collection": compact_collection(resolved_collection) if resolved_collection else None,
            "paper": compact_paper(resolved_paper) if resolved_paper else None,
        }
