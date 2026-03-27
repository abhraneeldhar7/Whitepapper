import logging
import pickle
from uuid import uuid4

from fastapi import HTTPException

from app.core.cache_policies import COLLECTION_CACHE_POLICY
from app.core.firestore_store import firestore_store, utc_now
from app.core.redis_client import get_cache_prefix, get_redis_client
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug

logger = logging.getLogger(__name__)

COLLECTIONS_COLLECTION = "collections"
COLLECTION_ID_KEY = "collectionId"
COLLECTION_OWNER_KEY = "ownerId"
COLLECTION_PROJECT_KEY = "projectId"
COLLECTION_SLUG_KEY = "slug"
COLLECTION_PUBLIC_KEY = "isPublic"


class CollectionsService:
    def _collection_by_id_key(self, collection_id: str) -> str:
        return f"{get_cache_prefix()}:collections:id:{collection_id}"

    def _collection_by_slug_key(self, project_id: str, slug: str) -> str:
        return f"{get_cache_prefix()}:collections:slug:{project_id}:{slug}"

    def _load_cached_collection(self, key: str) -> dict | None:
        client = get_redis_client()
        if not client:
            return None
        try:
            payload = client.get(key)
            if payload is None:
                return None
            value = pickle.loads(payload)
            return value if isinstance(value, dict) else None
        except Exception:
            logger.exception("Collection cache read failed for key=%s", key)
            return None

    def _set_cached_collection(self, collection: dict) -> None:
        client = get_redis_client()
        if not client:
            return

        collection_id = collection.get(COLLECTION_ID_KEY)
        project_id = collection.get(COLLECTION_PROJECT_KEY)
        slug = collection.get(COLLECTION_SLUG_KEY)
        if not collection_id and not (project_id and slug):
            return

        try:
            if collection_id:
                client.setex(
                    self._collection_by_id_key(collection_id),
                    COLLECTION_CACHE_POLICY.ttl_seconds,
                    pickle.dumps(collection),
                )
            if project_id and slug:
                client.setex(
                    self._collection_by_slug_key(project_id, slug),
                    COLLECTION_CACHE_POLICY.ttl_seconds,
                    pickle.dumps(collection),
                )
        except Exception:
            logger.exception("Collection cache write failed for collection_id=%s", collection_id)

    def invalidate_collection(self, collection_id: str, project_id: str | None = None, slug: str | None = None) -> None:
        client = get_redis_client()
        if not client:
            return

        keys = [self._collection_by_id_key(collection_id)]
        if project_id and slug:
            keys.append(self._collection_by_slug_key(project_id, slug))
        try:
            client.delete(*keys)
        except Exception:
            logger.exception("Collection cache invalidation failed for keys=%s", keys)

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
            "description": payload.get("description") or "",
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

    def set_visibility(self, collection_id: str, is_public: bool) -> dict:
        current = self.get_by_id(collection_id)
        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        updated = self.update(collection_id, {"isPublic": target_visibility})
        self._propagate_collection_visibility(collection_id, target_visibility)
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
        cached = self._load_cached_collection(self._collection_by_id_key(collection_id))
        if cached:
            if public and not self._is_public_collection(cached):
                raise HTTPException(status_code=404, detail="Collection not found.")
            return cached

        collection = firestore_store.get(COLLECTIONS_COLLECTION, collection_id)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if public and not self._is_public_collection(collection):
            raise HTTPException(status_code=404, detail="Collection not found.")
        self._set_cached_collection(collection)
        return collection

    def get_by_slug(self, project_id: str, collection_slug: str, public: bool = False) -> dict:
        cached = self._load_cached_collection(self._collection_by_slug_key(project_id, collection_slug))
        if cached:
            if public and not self._is_public_collection(cached):
                raise HTTPException(status_code=404, detail="Collection not found.")
            return cached

        filters: dict[str, object] = {
            COLLECTION_PROJECT_KEY: project_id,
            COLLECTION_SLUG_KEY: collection_slug,
        }
        if public:
            filters[COLLECTION_PUBLIC_KEY] = True
        matches = firestore_store.find_by_fields(COLLECTIONS_COLLECTION, filters)
        if not matches:
            raise HTTPException(status_code=404, detail="Collection not found.")
        collection = matches[0]
        self._set_cached_collection(collection)
        return collection

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
