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
    canonicalJson = json.dumps(encoded_payload, separators=(",", ":"), sort_keys=True)
    etagValue = hashlib.sha256(canonicalJson.encode("utf-8")).hexdigest()
    etag = f"\"{etagValue}\""
    headers = {
        "Cache-Control": f"public, max-age={max_age}, s-maxage={max_age}, stale-while-revalidate={max_age}"
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return JSONResponse(content=encoded_payload, headers=headers)


@router.get("/seo/papers")
async def get_public_papers_for_sitemap(request: Request) -> Response:
    papers = await asyncio.to_thread(papers_service.list_all_public)
    payloadItems: list[dict] = []

    for paper in papers:
        metadata = paper.get("metadata") if isinstance(paper.get("metadata"), dict) else {}
        canonical = metadata.get("canonical") if isinstance(metadata, dict) else None
        updated_at = metadata.get("dateModified") if isinstance(metadata, dict) else None

        if not canonical:
            ownerId = paper.get("ownerId")
            if not ownerId:
                continue
            try:
                owner = await asyncio.to_thread(user_service.get_by_id, ownerId)
            except HTTPException:
                continue
            ownerHandle = (owner.get("username") or "").strip().lower()
            slug = (paper.get("slug") or "").strip()
            if not ownerHandle or not slug:
                continue
            canonical = f"/{ownerHandle}/{slug}"
            updated_at = paper.get("updatedAt")

        payloadItems.append(
            {
                "url": canonical,
                "lastModified": updated_at or paper.get("updatedAt"),
            }
        )

    return _public_response({"papers": payloadItems}, request)


@router.get("/seo/profiles-projects")
async def get_public_profiles_projects_for_sitemap(request: Request) -> Response:
    projects = await asyncio.to_thread(projects_service.list_all_public)

    ownerCache: dict[str, dict] = {}
    profiles: dict[str, dict] = {}
    payload_projects: list[dict] = []

    for project in projects:
        ownerId = project.get("ownerId")
        if not ownerId:
            continue

        owner = ownerCache.get(ownerId)
        if owner is None:
            try:
                owner = await asyncio.to_thread(user_service.get_by_id, ownerId)
            except HTTPException:
                owner = {}
            ownerCache[ownerId] = owner

        ownerHandle = (owner.get("username") or "").strip().lower()
        projectSlug = (project.get("slug") or "").strip()
        if not ownerHandle or not projectSlug:
            continue

        profileLastModified = owner.get("updatedAt") or owner.get("createdAt")
        profiles[ownerHandle] = {
            "url": f"/{ownerHandle}",
            "lastModified": profileLastModified,
        }

        payload_projects.append(
            {
                "url": f"/{ownerHandle}/p/{projectSlug}",
                "lastModified": project.get("updatedAt"),
            }
        )

    return _public_response(
        {
            "profiles": list(profiles.values()),
            "projects": payload_projects,
        },
        request,
    )


@router.get("/{handle}")
async def get_public_profile(handle: str, request: Request) -> Response:
    user = await asyncio.to_thread(user_service.get_by_username, handle)
    ownerId = user.get("userId")
    if not ownerId:
        raise HTTPException(status_code=404, detail="User not found.")

    public_projects, papers = await asyncio.gather(
        asyncio.to_thread(projects_service.list_owned, ownerId, True),
        asyncio.to_thread(papers_service.list_standalone, ownerId, True),
    )

    return _public_response({
        "user": _public_user(user),
        "projects": [_public_project(project) for project in public_projects],
        "papers": [_public_paper(paper) for paper in papers],
    }, request)


@router.get("/{handle}/papers/{paperSlug}")
async def get_public_paper_page_data(handle: str, paperSlug: str, request: Request) -> Response:
    paper = await asyncio.to_thread(papers_service.get_by_slug, handle, paperSlug, True)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    return _public_response({
        "paper": _public_paper(paper),
    }, request)


@router.get("/{handle}/projects/{projectSlug}")
async def get_public_project(handle: str, projectSlug: str, request: Request) -> Response:
    user = await asyncio.to_thread(user_service.get_by_username, handle)
    project = await asyncio.to_thread(projects_service.get_by_slug, handle, projectSlug, True)
    papers, publicCollections = await asyncio.gather(
        asyncio.to_thread(papers_service.list_by_projectId, project["projectId"], True),
        asyncio.to_thread(collections_service.list_project_collections, project["projectId"], True),
    )

    return _public_response({
        "user": _public_user(user),
        "project": _public_project(project),
        "collections": [_public_collection(collection) for collection in publicCollections],
        "papers": [_public_paper(paper) for paper in papers],
    }, request)
