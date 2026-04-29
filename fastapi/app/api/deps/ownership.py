from __future__ import annotations

from fastapi import HTTPException

from app.services.collections_service import collections_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service


def require_owned_project(userId: str, projectId: str) -> dict:
    project = projects_service.get_by_id(projectId)
    if project.get("ownerId") != userId:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return project


def require_owned_collection(userId: str, collectionId: str) -> dict:
    collection = collections_service.get_by_id(collectionId)
    if collection.get("ownerId") != userId:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return collection


def require_owned_paper(userId: str, paperId: str) -> dict:
    paper = papers_service.get_by_id(paperId)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")
    if paper.get("ownerId") != userId:
        raise HTTPException(status_code=403, detail="Not allowed.")
    return paper
