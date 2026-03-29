import asyncio
import hashlib
import json

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.services.user_service import user_service

router = APIRouter(prefix="/public", tags=["public"])
PUBLIC_CACHE_SECONDS = 300


def _public_user(user: dict) -> dict:
    masked = dict(user)
    masked["userId"] = None
    masked["email"] = None
    masked["preferences"] = None
    return masked


def _public_project(project: dict) -> dict:
    masked = dict(project)
    masked["ownerId"] = None
    return masked


def _public_collection(collection: dict) -> dict:
    masked = dict(collection)
    masked["ownerId"] = None
    return masked


def _public_paper(paper: dict) -> dict:
    masked = dict(paper)
    masked["ownerId"] = None
    return masked


def _public_response(payload: dict, request: Request, *, max_age: int = PUBLIC_CACHE_SECONDS) -> Response:
    encoded_payload = jsonable_encoder(payload)
    canonical_json = json.dumps(encoded_payload, separators=(",", ":"), sort_keys=True)
    etag_value = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    etag = f"\"{etag_value}\""
    headers = {
        "Cache-Control": f"public, max-age={max_age}, s-maxage={max_age}",
        "ETag": etag,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return JSONResponse(content=encoded_payload, headers=headers)


@router.get("/seo/papers")
async def get_public_papers_for_sitemap(request: Request) -> Response:
    papers = await asyncio.to_thread(papers_service.list_all_public)
    payload_items: list[dict] = []

    for paper in papers:
        metadata = paper.get("metadata") if isinstance(paper.get("metadata"), dict) else {}
        canonical = metadata.get("canonical") if isinstance(metadata, dict) else None
        updated_at = metadata.get("dateModified") if isinstance(metadata, dict) else None

        if not canonical:
            owner_id = paper.get("ownerId")
            if not owner_id:
                continue
            try:
                owner = await asyncio.to_thread(user_service.get_by_id, owner_id)
            except HTTPException:
                continue
            owner_handle = (owner.get("username") or "").strip().lower()
            slug = (paper.get("slug") or "").strip()
            if not owner_handle or not slug:
                continue
            canonical = f"/{owner_handle}/{slug}"
            updated_at = paper.get("updatedAt")

        payload_items.append(
            {
                "url": canonical,
                "lastModified": updated_at or paper.get("updatedAt"),
            }
        )

    return _public_response({"papers": payload_items}, request)


@router.get("/{handle}")
async def get_public_profile(handle: str, request: Request) -> Response:
    user = await asyncio.to_thread(user_service.get_by_username, handle)
    owner_id = user["userId"]

    public_projects, papers = await asyncio.gather(
        asyncio.to_thread(projects_service.list_owned, owner_id, True),
        asyncio.to_thread(papers_service.list_standalone, owner_id, True),
    )

    return _public_response({
        "user": _public_user(user),
        "projects": [_public_project(project) for project in public_projects],
        "papers": [_public_paper(paper) for paper in papers],
    }, request)


@router.get("/{handle}/papers/{paper_slug}")
async def get_public_paper_page_data(handle: str, paper_slug: str, request: Request) -> Response:
    paper = await asyncio.to_thread(papers_service.get_by_slug, handle, paper_slug, True)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    return _public_response({
        "paper": _public_paper(paper),
    }, request)


@router.get("/{handle}/projects/{project_slug}")
async def get_public_project(handle: str, project_slug: str, request: Request) -> Response:
    user = await asyncio.to_thread(user_service.get_by_username, handle)
    project = await asyncio.to_thread(projects_service.get_by_slug, user["username"], project_slug, True)
    public_collections, papers = await asyncio.gather(
        asyncio.to_thread(collections_service.list_project_collections, project["projectId"], True),
        asyncio.to_thread(papers_service.list_by_project_id, project["projectId"], True, True),
    )
    collection_papers_data = await asyncio.gather(
        *[
            asyncio.to_thread(papers_service.list_by_collection_id, collection.get("collectionId"), True)
            for collection in public_collections
        ]
    ) if public_collections else []
    collection_papers = []
    for collection, collection_items in zip(public_collections, collection_papers_data):
        collection_papers.append(
            {
                "collectionId": collection.get("collectionId"),
                "papers": [_public_paper(item) for item in collection_items],
            }
        )

    return _public_response({
        "user": _public_user(user),
        "project": _public_project(project),
        "collections": [_public_collection(collection) for collection in public_collections],
        "papers": [_public_paper(paper) for paper in papers],
        "collectionPapers": collection_papers,
    }, request)


async def _get_public_collection_payload(collection_id: str) -> dict:
    collection = await asyncio.to_thread(collections_service.get_by_id, collection_id, True)
    project, papers = await asyncio.gather(
        asyncio.to_thread(projects_service.get_by_id, collection.get("projectId"), True),
        asyncio.to_thread(papers_service.list_by_collection_id, collection["collectionId"], True),
    )
    if collection.get("projectId") != project.get("projectId"):
        raise HTTPException(status_code=404, detail="Collection not found.")

    return {
        "project": _public_project(project),
        "collection": _public_collection(collection),
        "papers": [_public_paper(paper) for paper in papers],
    }


@router.get("/collections/{collection_id}")
async def get_public_collection_by_id_global(collection_id: str, request: Request) -> Response:
    return _public_response(await _get_public_collection_payload(collection_id), request)


@router.get("/{handle}/collections/{collection_id}")
async def get_public_collection_by_id(handle: str, collection_id: str, request: Request) -> Response:
    return _public_response(await _get_public_collection_payload(collection_id), request)


@router.get("/{handle}/projects/{project_slug}/collections/{collection_id}")
async def get_public_collection(handle: str, project_slug: str, collection_id: str, request: Request) -> Response:
    payload = await _get_public_collection_payload(collection_id)
    if payload["project"].get("slug") != project_slug:
        raise HTTPException(status_code=404, detail="Collection not found.")
    return _public_response(payload, request)
