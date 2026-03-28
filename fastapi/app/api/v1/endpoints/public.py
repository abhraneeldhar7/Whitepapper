from fastapi import APIRouter, HTTPException

from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.services.user_service import user_service

router = APIRouter(prefix="/public", tags=["public"])


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


@router.get("/{handle}")
def get_public_profile(handle: str) -> dict:
    user = user_service.get_by_username(handle)
    owner_id = user["userId"]

    public_projects = projects_service.list_owned(owner_id, public=True)
    papers = papers_service.list_standalone(owner_id=owner_id, public=True)

    return {
        "user": _public_user(user),
        "projects": [_public_project(project) for project in public_projects],
        "papers": [_public_paper(paper) for paper in papers],
    }


@router.get("/{handle}/papers/{paper_slug}")
def get_public_paper_page_data(handle: str, paper_slug: str) -> dict:
    paper = papers_service.get_by_slug(handle, paper_slug, public=True)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    return {
        "paper": _public_paper(paper),
    }


@router.get("/{handle}/projects/{project_slug}")
def get_public_project(handle: str, project_slug: str) -> dict:
    user = user_service.get_by_username(handle)
    project = projects_service.get_by_slug(user["username"], project_slug, public=True)
    public_collections = collections_service.list_project_collections(project["projectId"], public=True)
    papers = papers_service.list_by_project_id(project["projectId"], public=True, standalone=True)

    return {
        "user": _public_user(user),
        "project": _public_project(project),
        "collections": [_public_collection(collection) for collection in public_collections],
        "papers": [_public_paper(paper) for paper in papers],
    }


def _get_public_collection_payload(collection_id: str) -> dict:
    collection = collections_service.get_by_id(collection_id, public=True)
    project = projects_service.get_by_id(collection.get("projectId"), public=True)
    if collection.get("projectId") != project.get("projectId"):
        raise HTTPException(status_code=404, detail="Collection not found.")

    papers = papers_service.list_by_collection_id(collection["collectionId"], public=True)
    return {
        "project": _public_project(project),
        "collection": _public_collection(collection),
        "papers": [_public_paper(paper) for paper in papers],
    }


@router.get("/collections/{collection_id}")
def get_public_collection_by_id_global(collection_id: str) -> dict:
    return _get_public_collection_payload(collection_id)


@router.get("/{handle}/collections/{collection_id}")
def get_public_collection_by_id(handle: str, collection_id: str) -> dict:
    return _get_public_collection_payload(collection_id)


@router.get("/{handle}/projects/{project_slug}/collections/{collection_id}")
def get_public_collection(handle: str, project_slug: str, collection_id: str) -> dict:
    payload = _get_public_collection_payload(collection_id)
    if payload["project"].get("slug") != project_slug:
        raise HTTPException(status_code=404, detail="Collection not found.")
    return payload
