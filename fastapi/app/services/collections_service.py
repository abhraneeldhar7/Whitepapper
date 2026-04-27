import logging
import threading
from uuid import uuid4

from fastapi import HTTPException

from app.core.limits import MAX_COLLECTIONS_PER_PROJECT, MAX_DESCRIPTION_LENGTH
from app.core.firestore_store import firestore_store
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.utils.datetime import utc_now
from app.utils.pagination import apply_order_by, paginate_items

logger = logging.getLogger(__name__)

COLLECTIONS_COLLECTION = "collections"
COLLECTION_ID_KEY = "collectionId"
COLLECTION_OWNER_KEY = "ownerId"
COLLECTION_PROJECT_KEY = "projectId"
COLLECTION_SLUG_KEY = "slug"
COLLECTION_PUBLIC_KEY = "isPublic"
class CollectionsService:

    def invalidate_collection(self, collection_id: str, project_id: str | None = None, slug: str | None = None) -> None:
        return None

    def _unique_slug(self, project_id: str, source: str, exclude_collection_id: str | None = None) -> str:
        base = normalize_slug(source) or "collection"
        project_collections = self.list_project_collections(project_id)
        candidate = base
        while True:
            is_taken = any(
                str(item.get(COLLECTION_SLUG_KEY) or "").strip() == candidate
                and item.get(COLLECTION_ID_KEY) != exclude_collection_id
                for item in project_collections
            )
            if not is_taken:
                return candidate
            candidate = f"{base}-{uuid4().hex[:4]}"

    def _propagate_collection_visibility(self, collection_id: str, is_public: bool) -> None:
        from app.services.papers_service import papers_service

        target_status = "published" if is_public else "draft"
        papers = papers_service.list_by_collection_id(collection_id)
        for paper in papers:
            current_status = paper.get("status") or "draft"
            if current_status == "archived" or current_status == target_status:
                continue
            papers_service.update(paper["paperId"], {"status": target_status})

    def _run_collection_visibility_propagation(self, collection_id: str, is_public: bool) -> None:
        try:
            self._propagate_collection_visibility(collection_id, is_public)
        except Exception:
            logger.exception(
                "Collection visibility propagation failed for collection_id=%s is_public=%s",
                collection_id,
                is_public,
            )

    def _set_visibility_only(self, collection_id: str, is_public: bool) -> dict:
        current = self.get_by_id(collection_id)
        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        previous_slug = current.get(COLLECTION_SLUG_KEY)
        visibility_patch = {
            "isPublic": target_visibility,
            "updatedAt": utc_now(),
        }
        firestore_store.update(COLLECTIONS_COLLECTION, collection_id, visibility_patch)
        current.update(visibility_patch)
        self.invalidate_collection(
            collection_id=collection_id,
            project_id=current.get(COLLECTION_PROJECT_KEY),
            slug=previous_slug,
        )
        return current

    @staticmethod
    def _is_public_collection(collection: dict | None) -> bool:
        return bool(collection) and bool(collection.get(COLLECTION_PUBLIC_KEY))

    def list_project_collections(self, project_id: str, public: bool = False) -> list[dict]:
        items = firestore_store.find_by_fields(COLLECTIONS_COLLECTION, {COLLECTION_PROJECT_KEY: project_id})
        if public:
            return [item for item in items if bool(item.get(COLLECTION_PUBLIC_KEY))]
        return items

    def list_project_collections_paginated(
        self,
        project_id: str,
        *,
        public: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_project_collections(project_id, public=public)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def get_many_by_ids(self, collection_ids: list[str]) -> list[dict]:
        return firestore_store.get_many(COLLECTIONS_COLLECTION, collection_ids)

    def create(self, owner_id: str, payload: dict) -> dict:
        collection_id = str(uuid4())
        now = utc_now()
        project_id = payload.get(COLLECTION_PROJECT_KEY)
        if not project_id:
            raise HTTPException(status_code=400, detail="projectId is required.")

        projects_service.get_by_id(project_id)
        existing_collections = self.list_project_collections(project_id)
        if len(existing_collections) >= MAX_COLLECTIONS_PER_PROJECT:
            raise HTTPException(
                status_code=400,
                detail=f"Collection limit reached ({MAX_COLLECTIONS_PER_PROJECT}) for this project.",
            )

        description = payload.get("description") or ""
        if len(description) > MAX_DESCRIPTION_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Collection description is too long. "
                    f"Maximum length is {MAX_DESCRIPTION_LENGTH} characters."
                ),
            )

        provided_slug = payload.get(COLLECTION_SLUG_KEY)
        if provided_slug:
            slug_value = self._unique_slug(project_id, provided_slug)
        else:
            slug_value = self._unique_slug(project_id, payload.get("name") or "collection")

        created = {
            COLLECTION_ID_KEY: collection_id,
            COLLECTION_PROJECT_KEY: project_id,
            COLLECTION_OWNER_KEY: owner_id,
            "name": (payload.get("name") or "Untitled Collection").strip() or "Untitled Collection",
            "description": description,
            COLLECTION_SLUG_KEY: slug_value,
            "isPublic": bool(payload.get("isPublic", True)),
            "pagesNumber": 0,
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(COLLECTIONS_COLLECTION, created, doc_id=collection_id)
        return created

    def update(self, collection_id: str, payload: dict) -> dict:
        current = self.get_by_id(collection_id)

        allowed_update_fields = {"name", "title", "slug", "description", "isPublic"}
        payload = {key: value for key, value in payload.items() if key in allowed_update_fields}

        if "title" in payload and "name" not in payload:
            payload["name"] = payload["title"]
        payload.pop("title", None)

        if "name" in payload:
            payload["name"] = (payload.get("name") or "Untitled Collection").strip() or "Untitled Collection"
        if "description" in payload:
            payload["description"] = payload.get("description") or ""
            if len(payload["description"]) > MAX_DESCRIPTION_LENGTH:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Collection description is too long. "
                        f"Maximum length is {MAX_DESCRIPTION_LENGTH} characters."
                    ),
                )
        if "isPublic" in payload:
            payload["isPublic"] = bool(payload.get("isPublic"))
        if "slug" in payload:
            new_slug = normalize_slug(payload.get("slug") or "")
            if not new_slug:
                raise HTTPException(status_code=400, detail="Invalid slug.")
            matches = [
                item
                for item in self.list_project_collections(str(current.get(COLLECTION_PROJECT_KEY) or ""))
                if str(item.get(COLLECTION_SLUG_KEY) or "").strip() == new_slug
            ]
            if any(item.get(COLLECTION_ID_KEY) != collection_id for item in matches):
                raise HTTPException(status_code=409, detail="Collection slug already exists in this project.")
            payload["slug"] = new_slug

        if not payload:
            return current

        previous_slug = current.get(COLLECTION_SLUG_KEY)
        payload["updatedAt"] = utc_now()
        firestore_store.update(COLLECTIONS_COLLECTION, collection_id, payload)
        current.update(payload)
        self.invalidate_collection(
            collection_id=collection_id,
            project_id=current.get(COLLECTION_PROJECT_KEY),
            slug=previous_slug,
        )
        return current

    def set_visibility(self, collection_id: str, is_public: bool, *, background: bool = True) -> dict:
        updated = self._set_visibility_only(collection_id, is_public)
        target_visibility = bool(updated.get("isPublic", False))

        if background:
            worker = threading.Thread(
                target=self._run_collection_visibility_propagation,
                args=(collection_id, target_visibility),
                daemon=True,
            )
            worker.start()
        else:
            self._run_collection_visibility_propagation(collection_id, target_visibility)

        return updated

    def delete_cascade(self, collection_id: str) -> dict[str, int]:
        current = self.get_by_id(collection_id)

        from app.services.papers_service import papers_service

        deleted_counts = {
            "collections": 0,
            "papers": 0,
            "storageObjects": 0,
        }
        papers = papers_service.list_by_collection_id(collection_id)
        for paper in papers:
            result = papers_service.delete_cascade(paper["paperId"])
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        firestore_store.delete(COLLECTIONS_COLLECTION, collection_id)
        self.invalidate_collection(
            collection_id=collection_id,
            project_id=current.get(COLLECTION_PROJECT_KEY),
            slug=current.get(COLLECTION_SLUG_KEY),
        )
        deleted_counts["collections"] = 1
        return deleted_counts

    def delete(self, collection_id: str) -> dict[str, bool]:
        self.delete_cascade(collection_id)
        return {"ok": True}

    def get_by_id(self, collection_id: str, public: bool = False) -> dict:
        collection = firestore_store.get(COLLECTIONS_COLLECTION, collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if public and not self._is_public_collection(collection):
            raise HTTPException(status_code=404, detail="Collection not found.")
        return collection

    def get_by_slug(self, project_id: str, collection_slug: str, public: bool = False) -> dict:
        matches = [
            item
            for item in self.list_project_collections(project_id, public=public)
            if str(item.get(COLLECTION_SLUG_KEY) or "").strip() == collection_slug
        ]
        if not matches:
            raise HTTPException(status_code=404, detail="Collection not found.")
        return matches[0]

    def is_slug_available(self, project_id: str, slug: str, collection_id: str | None = None) -> bool:
        candidate = normalize_slug(slug or "")
        if not candidate:
            return False
        matches = [
            item
            for item in self.list_project_collections(project_id)
            if str(item.get(COLLECTION_SLUG_KEY) or "").strip() == candidate
        ]
        return all(item.get(COLLECTION_ID_KEY) == collection_id for item in matches)


collections_service = CollectionsService()
