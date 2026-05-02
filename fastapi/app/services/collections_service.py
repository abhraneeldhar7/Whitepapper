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

    def _unique_slug(self, projectId: str, source: str, excludeCollectionId: str | None = None) -> str:
        base = normalize_slug(source) or "collection"
        project_collections = self.list_project_collections(projectId)
        candidate = base
        while True:
            is_taken = any(
                str(item.get(COLLECTION_SLUG_KEY) or "").strip() == candidate
                and item.get(COLLECTION_ID_KEY) != excludeCollectionId
                for item in project_collections
            )
            if not is_taken:
                return candidate
            candidate = f"{base}-{uuid4().hex[:4]}"

    def _propagate_collection_visibility(self, collectionId: str, is_public: bool) -> None:
        from app.services.papers_service import papers_service

        target_status = "published" if is_public else "draft"
        papers = papers_service.list_by_collectionId(collectionId)
        for paper in papers:
            current_status = paper.get("status") or "draft"
            if current_status == "archived" or current_status == target_status:
                continue
            papers_service.update(paper["paperId"], {"status": target_status})

    def _run_collection_visibility_propagation(self, collectionId: str, is_public: bool) -> None:
        try:
            self._propagate_collection_visibility(collectionId, is_public)
        except Exception:
            logger.exception(
                "Collection visibility propagation failed for collectionId=%s is_public=%s",
                collectionId,
                is_public,
            )

    def _set_visibility_only(self, collectionId: str, is_public: bool) -> dict:
        current = self.get_by_id(collectionId)
        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        visibility_patch = {
            "isPublic": target_visibility,
            "updatedAt": utc_now(),
        }
        firestore_store.update(COLLECTIONS_COLLECTION, collectionId, visibility_patch)
        current.update(visibility_patch)
        return current

    @staticmethod
    def _is_public_collection(collection: dict | None) -> bool:
        return bool(collection) and bool(collection.get(COLLECTION_PUBLIC_KEY))

    def list_project_collections(self, projectId: str, public: bool = False) -> list[dict]:
        items = firestore_store.find_by_fields(COLLECTIONS_COLLECTION, {COLLECTION_PROJECT_KEY: projectId})
        if public:
            return [item for item in items if bool(item.get(COLLECTION_PUBLIC_KEY))]
        return items

    def list_project_collections_paginated(
        self,
        projectId: str,
        *,
        public: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_project_collections(projectId, public=public)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_apply_projections_paginated(
        self,
        projectId: str,
        *,
        limit: int = 25,
        cursor: str | None = None,
    ) -> dict:
        return self.list_project_collections_paginated(projectId, limit=limit, cursor=cursor)

    def get_many_by_ids(self, collectionIds: list[str]) -> list[dict]:
        return firestore_store.get_many(COLLECTIONS_COLLECTION, collectionIds)

    def create(self, ownerId: str, payload: dict) -> dict:
        collectionId = str(uuid4())
        now = utc_now()
        projectId = payload.get(COLLECTION_PROJECT_KEY)
        if not projectId:
            raise HTTPException(status_code=400, detail="projectId is required.")

        projects_service.get_by_id(projectId)
        existing_collections = self.list_project_collections(projectId)
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
            slug_value = self._unique_slug(projectId, provided_slug)
        else:
            slug_value = self._unique_slug(projectId, payload.get("name") or "collection")

        created = {
            COLLECTION_ID_KEY: collectionId,
            COLLECTION_PROJECT_KEY: projectId,
            COLLECTION_OWNER_KEY: ownerId,
            "name": (payload.get("name") or "Untitled Collection").strip() or "Untitled Collection",
            "description": description,
            COLLECTION_SLUG_KEY: slug_value,
            "isPublic": bool(payload.get("isPublic", True)),
            "pagesNumber": 0,
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(COLLECTIONS_COLLECTION, created, doc_id=collectionId)
        return created

    def update(self, collectionId: str, payload: dict) -> dict:
        current = self.get_by_id(collectionId)

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
            if any(item.get(COLLECTION_ID_KEY) != collectionId for item in matches):
                raise HTTPException(status_code=409, detail="Collection slug already exists in this project.")
            payload["slug"] = new_slug

        if not payload:
            return current

        payload["updatedAt"] = utc_now()
        firestore_store.update(COLLECTIONS_COLLECTION, collectionId, payload)
        current.update(payload)
        return current

    def set_visibility(self, collectionId: str, is_public: bool, *, background: bool = True) -> dict:
        updated = self._set_visibility_only(collectionId, is_public)
        target_visibility = bool(updated.get("isPublic", False))

        if background:
            worker = threading.Thread(
                target=self._run_collection_visibility_propagation,
                args=(collectionId, target_visibility),
                daemon=True,
            )
            worker.start()
        else:
            self._run_collection_visibility_propagation(collectionId, target_visibility)

        return updated

    def delete_cascade(self, collectionId: str) -> dict[str, int]:
        current = self.get_by_id(collectionId)

        from app.services.papers_service import papers_service

        deleted_counts = {
            "collections": 0,
            "papers": 0,
            "storageObjects": 0,
        }
        papers = papers_service.list_by_collectionId(collectionId)
        for paper in papers:
            result = papers_service.delete_cascade(paper["paperId"])
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        firestore_store.delete(COLLECTIONS_COLLECTION, collectionId)
        deleted_counts["collections"] = 1
        return deleted_counts

    def delete(self, collectionId: str) -> dict[str, bool]:
        self.delete_cascade(collectionId)
        return {"ok": True}

    def get_by_id(self, collectionId: str, public: bool = False) -> dict:
        collection = firestore_store.get(COLLECTIONS_COLLECTION, collectionId)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if public and not self._is_public_collection(collection):
            raise HTTPException(status_code=404, detail="Collection not found.")
        return collection

    def get_by_slug(self, projectId: str, collectionSlug: str, public: bool = False) -> dict:
        matches = [
            item
            for item in self.list_project_collections(projectId, public=public)
            if str(item.get(COLLECTION_SLUG_KEY) or "").strip() == collectionSlug
        ]
        if not matches:
            raise HTTPException(status_code=404, detail="Collection not found.")
        return matches[0]

    def is_slug_available(self, projectId: str, slug: str, collectionId: str | None = None) -> bool:
        candidate = normalize_slug(slug or "")
        if not candidate:
            return False
        matches = [
            item
            for item in self.list_project_collections(projectId)
            if str(item.get(COLLECTION_SLUG_KEY) or "").strip() == candidate
        ]
        return all(item.get(COLLECTION_ID_KEY) == collectionId for item in matches)

collections_service = CollectionsService()
