from fastapi import APIRouter, HTTPException

from app.schemas.entities import PublicPaperPagePayload
from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.services.user_service import user_service

router = APIRouter(prefix="/public", tags=["public"])


def _is_public_project(project: dict) -> bool:
    return bool(project.get("isPublic"))


def _is_public_collection(collection: dict) -> bool:
    return bool(collection.get("isPublic"))


def _is_published_paper(paper: dict) -> bool:
    return paper.get("status") == "published"


@router.get("/{handle}")
def get_public_profile(handle: str) -> dict:
    user = user_service.get_by_username(handle)
    owner_id = user["userId"]

    public_projects = [item for item in projects_service.list_owned(owner_id) if _is_public_project(item)]
    papers = [item for item in papers_service.list_owned_filtered(owner_id=owner_id, standalone=True) if _is_published_paper(item)]

    return {"user": user, "projects": public_projects, "papers": papers}


@router.get("/{handle}/papers/{paper_slug}", response_model=PublicPaperPagePayload)
def get_public_paper_page_data(handle: str, paper_slug: str) -> PublicPaperPagePayload:
    user = user_service.get_by_username(handle)
    paper = papers_service.get_by_slug(user["username"], paper_slug)
    if not paper or not _is_published_paper(paper):
        raise HTTPException(status_code=404, detail="Paper not found.")

    return {
        "paper": paper,
        "author": {
            "username": user["username"],
            "displayName": user.get("displayName"),
            "avatarUrl": user.get("avatarUrl"),
        },
    }


@router.get("/{handle}/projects/{project_slug}")
def get_public_project(handle: str, project_slug: str) -> dict:
    user = user_service.get_by_username(handle)
    project = projects_service.get_by_slug(user["username"], project_slug)
    if not _is_public_project(project):
        raise HTTPException(status_code=404, detail="Project not found.")

    all_collections = collections_service.list_project_collections(project["projectId"])
    public_collections = [item for item in all_collections if _is_public_collection(item)]

    papers = [
        item
        for item in papers_service.list_by_project_id(project["projectId"])
        if _is_published_paper(item) and not item.get("collectionId")
    ]

    return {
        "user": user,
        "project": project,
        "collections": public_collections,
        "papers": papers,
    }


@router.get("/{handle}/projects/{project_slug}/collections/{collection_id}")
def get_public_collection(handle: str, project_slug: str, collection_id: str) -> dict:
    user = user_service.get_by_username(handle)
    project = projects_service.get_by_slug(user["username"], project_slug)
    if not _is_public_project(project):
        raise HTTPException(status_code=404, detail="Project not found.")

    collection = collections_service.get_by_id(collection_id)
    if collection.get("ownerId") != user["userId"] or collection.get("projectId") != project["projectId"]:
        raise HTTPException(status_code=404, detail="Collection not found.")
    if not _is_public_collection(collection):
        raise HTTPException(status_code=404, detail="Collection not found.")

    papers = [
        item for item in papers_service.list_by_collection_id(collection["collectionId"]) if _is_published_paper(item)
    ]
    return {"project": project, "collection": collection, "papers": papers}
