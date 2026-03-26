from fastapi import HTTPException
from uuid import uuid4

from app.core.cache_policies import COLLECTION_CACHE_POLICY
from app.core.firestore_store import firestore_store, utc_now
from app.services.cache_service import cache_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug


class CollectionsService:
    def _cache_key_by_id(self, collection_id: str) -> str:
        return cache_service.build_key(COLLECTION_CACHE_POLICY.namespace, "id", collection_id)

    def _cache_key_by_slug(self, owner_id: str, project_id: str, slug: str) -> str:
        return cache_service.build_key(
            COLLECTION_CACHE_POLICY.namespace,
            "slug",
            owner_id,
            project_id,
            normalize_slug(slug),
        )

    def _cache_document(self, collection: dict | None) -> None:
        if not collection:
            return
        collection_id = collection.get("collectionId")
        owner_id = collection.get("ownerId")
        project_id = collection.get("projectId")
        slug = collection.get("slug")
        if collection_id:
            cache_service.set(self._cache_key_by_id(collection_id), collection, COLLECTION_CACHE_POLICY.ttl_seconds)
        if owner_id and project_id and slug:
            cache_service.set(
                self._cache_key_by_slug(owner_id, project_id, slug),
                collection,
                COLLECTION_CACHE_POLICY.ttl_seconds,
            )

    def invalidate_cache_entry(
        self,
        collection_id: str,
        owner_id: str | None,
        project_id: str | None,
        old_slug: str | None,
        new_slug: str | None = None,
    ) -> None:
        keys = [self._cache_key_by_id(collection_id)]
        if owner_id and project_id and old_slug:
            keys.append(self._cache_key_by_slug(owner_id, project_id, old_slug))
        if owner_id and project_id and new_slug:
            keys.append(self._cache_key_by_slug(owner_id, project_id, new_slug))
        cache_service.delete_many(*keys)

    def _is_slug_conflict(self, project_id: str, slug: str, collection_id: str | None = None) -> bool:
        normalized = normalize_slug(slug)
        if not normalized:
            return True

        existing = firestore_store.find_by_fields(
            "collections",
            {"projectId": project_id, "slug": normalized},
        )
        return any(item.get("collectionId") != collection_id for item in existing)

    def _generate_unique_slug(self, project_id: str, source: str) -> str:
        base = normalize_slug(source) or "collection"
        if not self._is_slug_conflict(project_id, base):
            return base

        for _ in range(20):
            suffix = uuid4().hex[:6]
            candidate = f"{base}-{suffix}"
            if not self._is_slug_conflict(project_id, candidate):
                return candidate

        return f"{base}-{uuid4().hex[:8]}"

    def _propagate_collection_visibility(self, collection_id: str, is_public: bool) -> None:
        from app.services.papers_service import papers_service

        target_status = "published" if is_public else "draft"
        papers = papers_service.list_by_collection_id(collection_id)
        for paper in papers:
            current_status = paper.get("status") or "draft"
            if current_status == "archived" or current_status == target_status:
                continue
            paper_id = paper.get("paperId")
            if not paper_id:
                continue
            paper_owner_id = paper.get("ownerId")
            if not paper_owner_id:
                continue
            papers_service.update(
                paper_id,
                paper_owner_id,
                {"status": target_status},
            )

    def list_project_collections(self, project_id: str) -> list[dict]:
        return firestore_store.find_by_fields("collections", {"projectId": project_id})

    def create(self, owner_id: str, payload: dict) -> dict:
        collection_id = str(uuid4())
        now = utc_now()
        project_id = payload.get("projectId")
        if not project_id:
            raise HTTPException(status_code=400, detail="projectId is required.")

        project = projects_service.get_by_id(project_id)
        if project.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        provided_slug = payload.get("slug")
        if provided_slug:
            normalized = normalize_slug(provided_slug)
            if self._is_slug_conflict(project_id, normalized):
                raise HTTPException(status_code=409, detail="Collection slug already exists in this project.")
            payload["slug"] = normalized
        else:
            payload["slug"] = self._generate_unique_slug(project_id, payload.get("name") or "collection")

        if payload.get("isPublic") is None:
            payload["isPublic"] = True
        else:
            payload["isPublic"] = bool(payload["isPublic"])

        payload["ownerId"] = owner_id
        payload["collectionId"] = collection_id
        payload["name"] = (payload.get("name") or "Untitled Collection").strip() or "Untitled Collection"
        payload["description"] = payload.get("description") or ""
        payload["pagesNumber"] = 0
        payload["createdAt"] = now
        payload["updatedAt"] = now
        firestore_store.create("collections", payload, doc_id=collection_id)
        return payload

    def update(self, collection_id: str, owner_id: str, payload: dict) -> dict:
        current = firestore_store.get("collections", collection_id)
        if not current:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        allowed_update_fields = {"name", "title", "slug", "description"}
        payload = {key: value for key, value in payload.items() if key in allowed_update_fields}

        if "title" in payload and "name" not in payload:
            payload["name"] = payload["title"]
        payload.pop("title", None)

        if "name" in payload:
            payload["name"] = (payload.get("name") or "Untitled Collection").strip() or "Untitled Collection"

        if "description" in payload:
            payload["description"] = payload.get("description") or ""

        if "slug" in payload:
            new_slug = normalize_slug(payload.get("slug") or "")
            if not new_slug:
                raise HTTPException(status_code=400, detail="Invalid slug.")
            project_id = str(current.get("projectId") or "")
            if self._is_slug_conflict(project_id, new_slug, collection_id):
                raise HTTPException(status_code=409, detail="Collection slug already exists in this project.")
            payload["slug"] = new_slug

        if not payload:
            return current
        previous_slug = current.get("slug")
        payload["updatedAt"] = utc_now()
        firestore_store.update("collections", collection_id, payload)
        current.update(payload)
        self.invalidate_cache_entry(
            collection_id=collection_id,
            owner_id=current.get("ownerId"),
            project_id=current.get("projectId"),
            old_slug=previous_slug,
            new_slug=current.get("slug"),
        )
        return current

    def set_visibility(self, collection_id: str, owner_id: str, is_public: bool) -> dict:
        current = self.get_by_id(collection_id, owner_id=owner_id)
        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        previous_slug = current.get("slug")
        payload = {"isPublic": target_visibility, "updatedAt": utc_now()}
        firestore_store.update("collections", collection_id, payload)
        current.update(payload)
        self.invalidate_cache_entry(
            collection_id=collection_id,
            owner_id=current.get("ownerId"),
            project_id=current.get("projectId"),
            old_slug=previous_slug,
            new_slug=current.get("slug"),
        )
        self._propagate_collection_visibility(collection_id, target_visibility)
        return current

    def delete(self, collection_id: str, owner_id: str | None = None) -> dict[str, bool]:
        current = self.get_by_id(collection_id, owner_id=owner_id)

        from app.services.papers_service import papers_service

        papers = papers_service.list_by_collection_id(collection_id)
        for paper in papers:
            paper_id = paper.get("paperId")
            if paper_id:
                papers_service.delete(paper_id)

        firestore_store.delete("collections", collection_id)
        self.invalidate_cache_entry(
            collection_id=collection_id,
            owner_id=current.get("ownerId"),
            project_id=current.get("projectId"),
            old_slug=current.get("slug"),
        )
        return {"ok": True}

    def get_by_id(
        self,
        collection_id: str,
        owner_id: str | None = None,
    ) -> dict:
        cached = cache_service.get(self._cache_key_by_id(collection_id))
        collection = cached if isinstance(cached, dict) else None
        if collection is None:
            collection = firestore_store.get("collections", collection_id)
            if collection:
                self._cache_document(collection)
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found.")
        if owner_id and collection.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
        return collection

    def get_by_slug(
        self,
        owner_id: str,
        project_id: str,
        collection_slug: str,
    ) -> dict:
        cached = cache_service.get(self._cache_key_by_slug(owner_id, project_id, collection_slug))
        if isinstance(cached, dict):
            return cached

        matches = firestore_store.find_by_fields(
            "collections",
            {
                "ownerId": owner_id,
                "projectId": project_id,
                "slug": normalize_slug(collection_slug),
            },
        )
        if not matches:
            raise HTTPException(status_code=404, detail="Collection not found.")
        collection = matches[0]
        self._cache_document(collection)
        return collection

    def is_slug_available(self, project_id: str, slug: str, collection_id: str | None = None) -> bool:
        return not self._is_slug_conflict(project_id, slug, collection_id)

collections_service = CollectionsService()
