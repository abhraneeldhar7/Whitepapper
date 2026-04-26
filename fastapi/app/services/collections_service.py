import logging
import threading
from uuid import uuid4

from fastapi import HTTPException

from app.core.limits import MAX_COLLECTIONS_PER_PROJECT, MAX_DESCRIPTION_LENGTH
from app.core.firestore_store import firestore_store
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.utils.datetime import utc_now

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
        candidate = base
        while True:
            matches = firestore_store.find_by_fields(
                COLLECTIONS_COLLECTION,
                {COLLECTION_PROJECT_KEY: project_id, COLLECTION_SLUG_KEY: candidate},
            )
            if all(item.get(COLLECTION_ID_KEY) == exclude_collection_id for item in matches):
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
        filters: dict[str, object] = {COLLECTION_PROJECT_KEY: project_id}
        if public:
            filters[COLLECTION_PUBLIC_KEY] = True
        return firestore_store.find_by_fields(COLLECTIONS_COLLECTION, filters)

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
            matches = firestore_store.find_by_fields(
                COLLECTIONS_COLLECTION,
                {COLLECTION_PROJECT_KEY: str(current.get(COLLECTION_PROJECT_KEY)), COLLECTION_SLUG_KEY: new_slug},
            )
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

    def delete(self, collection_id: str) -> dict[str, bool]:
        current = self.get_by_id(collection_id)

        from app.services.papers_service import papers_service

        papers = papers_service.list_by_collection_id(collection_id)
        for paper in papers:
            papers_service.delete(paper["paperId"])

        firestore_store.delete(COLLECTIONS_COLLECTION, collection_id)
        self.invalidate_collection(
            collection_id=collection_id,
            project_id=current.get(COLLECTION_PROJECT_KEY),
            slug=current.get(COLLECTION_SLUG_KEY),
        )
        return {"ok": True}

    def get_by_id(self, collection_id: str, public: bool = False) -> dict:
        collection = firestore_store.get(COLLECTIONS_COLLECTION, collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if public and not self._is_public_collection(collection):
            raise HTTPException(status_code=404, detail="Collection not found.")
        return collection

    def get_by_slug(self, project_id: str, collection_slug: str, public: bool = False) -> dict:
        filters: dict[str, object] = {
            COLLECTION_PROJECT_KEY: project_id,
            COLLECTION_SLUG_KEY: collection_slug,
        }
        if public:
            filters[COLLECTION_PUBLIC_KEY] = True
        matches = firestore_store.find_by_fields(COLLECTIONS_COLLECTION, filters)
        if not matches:
            raise HTTPException(status_code=404, detail="Collection not found.")
        return matches[0]

    def is_slug_available(self, project_id: str, slug: str, collection_id: str | None = None) -> bool:
        candidate = normalize_slug(slug or "")
        if not candidate:
            return False
        matches = firestore_store.find_by_fields(
            COLLECTIONS_COLLECTION,
            {COLLECTION_PROJECT_KEY: project_id, COLLECTION_SLUG_KEY: candidate},
        )
        return all(item.get(COLLECTION_ID_KEY) == collection_id for item in matches)


collections_service = CollectionsService()
