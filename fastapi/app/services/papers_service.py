from fastapi import HTTPException, UploadFile
from uuid import uuid4
import time
from urllib.parse import urlsplit, urlunsplit

from app.core.cache_policies import PAPER_CACHE_POLICY
from app.core.firestore_store import firestore_store, utc_now
from app.core.reserved_paths import is_reserved_paper_slug
from app.core.constants import (
    MAX_EMBEDDED_HEIGHT,
    MAX_EMBEDDED_WIDTH,
    MAX_THUMBNAIL_HEIGHT,
    MAX_THUMBNAIL_WIDTH,
)
from app.services.cache_service import cache_service
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
    def _cache_key_by_id(self, paper_id: str) -> str:
        return cache_service.build_key(PAPER_CACHE_POLICY.namespace, "id", paper_id)

    def _cache_key_by_slug(self, owner_id: str, slug: str) -> str:
        return cache_service.build_key(
            PAPER_CACHE_POLICY.namespace,
            "slug",
            owner_id,
            normalize_slug(slug),
        )

    def _cache_document(self, paper: dict | None) -> None:
        if not paper:
            return
        paper_id = paper.get("paperId")
        if paper_id:
            cache_service.set(self._cache_key_by_id(paper_id), paper, PAPER_CACHE_POLICY.ttl_seconds)

        owner_id = paper.get("ownerId")
        slug = paper.get("slug")
        if owner_id and slug:
            cache_service.set(
                self._cache_key_by_slug(owner_id, slug),
                paper,
                PAPER_CACHE_POLICY.ttl_seconds,
            )

    def _invalidate_document_cache(
        self,
        paper_id: str,
        owner_id: str | None,
        old_slug: str | None,
        new_slug: str | None = None,
    ) -> None:
        keys = [self._cache_key_by_id(paper_id)]

        if owner_id and old_slug:
            keys.append(self._cache_key_by_slug(owner_id, old_slug))
        if owner_id and new_slug:
            keys.append(self._cache_key_by_slug(owner_id, new_slug))

        cache_service.delete_many(*keys)

    @staticmethod
    def _paper_matches_scope(paper: dict, project_id: str | None, standalone: bool) -> bool:
        if project_id:
            if paper.get("projectId") != project_id:
                return False
            if standalone and paper.get("collectionId"):
                return False
            return True

        if standalone:
            return not paper.get("projectId")

        return True

    @staticmethod
    def _get_by_id_from_store(paper_id: str) -> dict | None:
        return firestore_store.get("papers", paper_id)

    def _refresh_collection_pages_number(self, collection_id: str) -> None:
        from app.services.collections_service import collections_service

        collection_papers = self.list_by_collection_id(collection_id)
        now = utc_now()
        firestore_store.update(
            "collections",
            collection_id,
            {"pagesNumber": len(collection_papers), "updatedAt": now},
        )
        collection = firestore_store.get("collections", collection_id)
        if collection:
            collection["pagesNumber"] = len(collection_papers)
            collection["updatedAt"] = now
            collections_service.invalidate_cache_entry(
                collection_id=collection_id,
                owner_id=collection.get("ownerId"),
                project_id=collection.get("projectId"),
                old_slug=collection.get("slug"),
                new_slug=collection.get("slug"),
            )

    def _refresh_project_pages_number(self, project_id: str) -> None:
        from app.services.projects_service import projects_service

        project_papers = self.list_by_project_id(project_id)
        now = utc_now()
        firestore_store.update(
            "projects",
            project_id,
            {"pagesNumber": len(project_papers), "updatedAt": now},
        )
        project = firestore_store.get("projects", project_id)
        if project:
            project["pagesNumber"] = len(project_papers)
            project["updatedAt"] = now
            projects_service.invalidate_cache_entry(
                project_id=project_id,
                owner_id=project.get("ownerId"),
                old_slug=project.get("slug"),
                new_slug=project.get("slug"),
            )

    def list_owned(self, owner_id: str) -> list[dict]:
        return firestore_store.find_by_fields("papers", {"ownerId": owner_id})

    def list_owned_filtered(
        self,
        owner_id: str,
        project_id: str | None = None,
        standalone: bool = False,
    ) -> list[dict]:
        papers = self.list_owned(owner_id)
        return [paper for paper in papers if self._paper_matches_scope(paper, project_id, standalone)]

    def list_by_project_id(self, project_id: str) -> list[dict]:
        return firestore_store.find_by_fields("papers", {"projectId": project_id})

    def list_by_collection_id(self, collection_id: str) -> list[dict]:
        return firestore_store.find_by_fields("papers", {"collectionId": collection_id})

    def get_by_id(self, paper_id: str) -> dict | None:
        cached = cache_service.get(self._cache_key_by_id(paper_id))
        if isinstance(cached, dict):
            return cached

        paper = self._get_by_id_from_store(paper_id)
        self._cache_document(paper)
        return paper

    def find_by_slug(self, slug: str, owner_id: str | None = None) -> dict | None:
        normalized_slug = normalize_slug(slug)
        if not normalized_slug:
            return None

        if owner_id:
            cached = cache_service.get(self._cache_key_by_slug(owner_id, normalized_slug))
            if isinstance(cached, dict):
                return cached

        filters: dict[str, str] = {"slug": normalized_slug}
        if owner_id:
            filters["ownerId"] = owner_id
        matches = firestore_store.find_by_fields("papers", filters)
        paper = matches[0] if matches else None
        self._cache_document(paper)
        return paper

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
            self._refresh_collection_pages_number(collection_id)

        # Recalculate project pagesNumber if paper is added to a project
        resolved_project_id = payload.get("projectId")
        if resolved_project_id:
            self._refresh_project_pages_number(resolved_project_id)

        return {"paperId": paper_id, "projectId": resolved_project_id}

    def update(self, paper_id: str, owner_id: str, payload: dict) -> dict:
        current = self._get_by_id_from_store(paper_id)
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

        previous_slug = current.get("slug")
        payload["updatedAt"] = utc_now()
        firestore_store.update("papers", paper_id, payload)
        current.update(payload)
        self._invalidate_document_cache(
            paper_id=paper_id,
            owner_id=current.get("ownerId"),
            old_slug=previous_slug,
            new_slug=current.get("slug"),
        )
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
            f"users/{owner_id}/papers/{paper_id}/thumbnail",
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
            f"users/{owner_id}/papers/{paper_id}/embedded",
            file,
            max_width=MAX_EMBEDDED_WIDTH,
            max_height=MAX_EMBEDDED_HEIGHT,
            crop=False,
        )
        return {"url": url}

    def delete(self, paper_id: str, owner_id: str | None = None) -> dict[str, bool]:
        current = self._get_by_id_from_store(paper_id)
        if not current:
            raise HTTPException(status_code=404, detail="papers not found.")
        if owner_id and current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        collection_id = current.get("collectionId")
        project_id = current.get("projectId")
        resolved_owner_id = current.get("ownerId")
        if resolved_owner_id:
            storage_service.delete_paper_assets(resolved_owner_id, paper_id)
        firestore_store.delete("papers", paper_id)

        self._invalidate_document_cache(
            paper_id=paper_id,
            owner_id=current.get("ownerId"),
            old_slug=current.get("slug"),
        )

        # Recalculate collection pagesNumber if paper was in a collection
        if collection_id:
            self._refresh_collection_pages_number(collection_id)

        # Recalculate project pagesNumber if paper was in a project
        if project_id:
            self._refresh_project_pages_number(project_id)

        return {"ok": True}

    def is_slug_available(self, owner_id: str, slug: str, paper_id: str | None = None) -> bool:
        normalized = normalize_slug(slug)
        if not normalized or is_reserved_paper_slug(normalized):
            return False

        existing = self.find_by_slug(normalized, owner_id=owner_id)
        if not existing:
            return True
        return existing.get("paperId") == paper_id


papers_service = PapersService()
