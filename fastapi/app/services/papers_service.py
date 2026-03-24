from fastapi import HTTPException, UploadFile
from uuid import uuid4
import time
from urllib.parse import urlsplit, urlunsplit

from app.core.firestore_store import firestore_store, utc_now
from app.core.reserved_paths import is_reserved_paper_slug
from app.core.constants import (
    MAX_EMBEDDED_HEIGHT,
    MAX_EMBEDDED_WIDTH,
    MAX_THUMBNAIL_HEIGHT,
    MAX_THUMBNAIL_WIDTH,
)
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service


def _with_cache_buster(url: str) -> str:
    """Add cache buster timestamp to URL if not already present."""
    parts = urlsplit(url)
    if parts.query:
        return url
    stamp = int(time.time() * 1000)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, f"time={stamp}", ""))


class PapersService:
    def list_owned(self, owner_id: str) -> list[dict]:
        return firestore_store.find_by_fields("papers", {"ownerId": owner_id})

    def list_by_project_id(self, project_id: str) -> list[dict]:
        return firestore_store.find_by_fields("papers", {"projectId": project_id})

    def list_by_collection_id(self, collection_id: str) -> list[dict]:
        return firestore_store.find_by_fields("papers", {"collectionId": collection_id})

    def get_by_id(self, paper_id: str) -> dict | None:
        return firestore_store.get("papers", paper_id)

    def find_by_slug(self, slug: str, owner_id: str | None = None) -> dict | None:
        filters: dict[str, str] = {"slug": normalize_slug(slug)}
        if owner_id:
            filters["ownerId"] = owner_id
        matches = firestore_store.find_by_fields("papers", filters)
        return matches[0] if matches else None

    def create(self, owner_id: str, payload: dict) -> dict:
        paper_id = str(uuid4())
        now = utc_now()
        payload["title"] = (payload.get("title") or "Untitled Paper").strip() or "Untitled Paper"

        collection_id = payload.get("collectionId")
        project_id = payload.get("projectId")
        if collection_id:
            collection = firestore_store.get("collections", collection_id)
            if not collection:
                raise HTTPException(status_code=404, detail="Collection not found.")
            if collection.get("ownerId") != owner_id:
                raise HTTPException(status_code=403, detail="Not allowed.")
            payload["projectId"] = collection.get("projectId")
            payload["status"] = "published" if collection.get("isPublic", False) else "draft"
        elif project_id:
            project = projects_service.get_by_id(project_id)
            if project.get("ownerId") != owner_id:
                raise HTTPException(status_code=403, detail="Not allowed.")
            payload["status"] = "published" if project.get("isPublic", False) else "draft"
        else:
            payload["status"] = payload.get("status") or "draft"

        if payload.get("slug"):
            payload["slug"] = normalize_slug(payload["slug"])
            if is_reserved_paper_slug(payload["slug"]):
                raise HTTPException(status_code=409, detail="Slug is reserved.")
            existing = firestore_store.find_by_fields(
                "papers",
                {"ownerId": owner_id, "slug": payload["slug"]},
            )
            if existing:
                raise HTTPException(status_code=409, detail="Paper slug already exists.")
        else:
            payload["slug"] = f"paper-{paper_id}"

        payload["ownerId"] = owner_id
        payload["paperId"] = paper_id
        payload["createdAt"] = now
        payload["updatedAt"] = now
        firestore_store.create("papers", payload, doc_id=paper_id)
        
        # Recalculate collection pagesNumber if paper is added to a collection
        if collection_id:
            collection_papers = firestore_store.find_by_fields("papers", {"collectionId": collection_id})
            firestore_store.update("collections", collection_id, {
                "pagesNumber": len(collection_papers),
                "updatedAt": utc_now()
            })
        
        # Recalculate project pagesNumber if paper is added to a project
        if project_id:
            project_papers = firestore_store.find_by_fields("papers", {"projectId": project_id})
            firestore_store.update("projects", project_id, {
                "pagesNumber": len(project_papers),
                "updatedAt": utc_now()
            })
        
        return {"paperId": paper_id, "projectId": payload.get("projectId")}

    def update(self, paper_id: str, owner_id: str, payload: dict) -> dict:
        current = firestore_store.get("papers", paper_id)
        if not current:
            raise HTTPException(status_code=404, detail="papers not found.")
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        if payload.get("slug"):
            new_slug = normalize_slug(payload["slug"])
            if is_reserved_paper_slug(new_slug):
                raise HTTPException(status_code=409, detail="Slug is reserved.")
            existing = firestore_store.find_by_fields(
                "papers",
                {"ownerId": owner_id, "slug": new_slug},
            )
            if any(item.get("paperId") != paper_id for item in existing):
                raise HTTPException(status_code=409, detail="Paper slug already exists.")
            payload["slug"] = new_slug

        if not payload:
            return current
        payload["updatedAt"] = utc_now()
        firestore_store.update("papers", paper_id, payload)
        current.update(payload)
        return current

    async def upload_thumbnail(
        self, paper_id: str, owner_id: str, file: UploadFile
    ) -> dict[str, str]:
        """Upload a thumbnail image for a paper."""
        paper = self.get_by_id(paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        if paper.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        url = await storage_service.upload_image(
            f"papers/{paper_id}/thumbnail",
            file,
            max_width=MAX_THUMBNAIL_WIDTH,
            max_height=MAX_THUMBNAIL_HEIGHT,
            crop=False,
            overwrite_name="thumbnail",
        )
        url = _with_cache_buster(url)
        self.update(paper_id, owner_id, {"thumbnailUrl": url})
        return {"url": url}

    async def upload_embedded_image(
        self, paper_id: str, owner_id: str, file: UploadFile
    ) -> dict[str, str]:
        """Upload an embedded image for the editor."""
        paper = self.get_by_id(paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        if paper.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        url = await storage_service.upload_image(
            f"papers/{paper_id}/embedded",
            file,
            max_width=MAX_EMBEDDED_WIDTH,
            max_height=MAX_EMBEDDED_HEIGHT,
            crop=False,
        )
        return {"url": url}

    def delete(self, paper_id: str, owner_id: str | None = None) -> dict[str, bool]:
        current = firestore_store.get("papers", paper_id)
        if not current:
            raise HTTPException(status_code=404, detail="papers not found.")
        if owner_id and current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
        
        collection_id = current.get("collectionId")
        project_id = current.get("projectId")
        storage_service.delete_paper_assets(paper_id)
        firestore_store.delete("papers", paper_id)
        
        # Recalculate collection pagesNumber if paper was in a collection
        if collection_id:
            collection_papers = firestore_store.find_by_fields("papers", {"collectionId": collection_id})
            firestore_store.update("collections", collection_id, {
                "pagesNumber": len(collection_papers),
                "updatedAt": utc_now()
            })
        
        # Recalculate project pagesNumber if paper was in a project
        if project_id:
            project_papers = firestore_store.find_by_fields("papers", {"projectId": project_id})
            firestore_store.update("projects", project_id, {
                "pagesNumber": len(project_papers),
                "updatedAt": utc_now()
            })
        
        return {"ok": True}

    def is_slug_available(self, owner_id: str, slug: str, paper_id: str | None = None) -> bool:
        normalized = normalize_slug(slug)
        if is_reserved_paper_slug(normalized):
            return False

        existing = self.find_by_slug(normalized, owner_id=owner_id)
        if not existing:
            return True
        return existing.get("paperId") == paper_id


papers_service = PapersService()
