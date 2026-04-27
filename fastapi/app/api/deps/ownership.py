from __future__ import annotations

from fastapi import HTTPException

from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service


def require_owned_project(user_id: str, project_id: str) -> dict:
    project = projects_service.get_by_id(project_id)
    if project.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return project


def require_owned_collection(user_id: str, collection_id: str) -> dict:
    collection = collections_service.get_by_id(collection_id)
    if collection.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return collection


def require_owned_paper(user_id: str, paper_id: str) -> dict:
    paper = papers_service.get_by_id(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != user_id:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return paper
