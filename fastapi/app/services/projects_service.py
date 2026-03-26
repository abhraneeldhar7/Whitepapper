from fastapi import HTTPException
from fastapi import UploadFile
from uuid import uuid4

from app.core.cache_policies import PROJECT_CACHE_POLICY
from app.core.firestore_store import firestore_store, utc_now
from app.core.reserved_paths import is_reserved_project_slug
from app.core.constants import (
    MAX_EMBEDDED_HEIGHT,
    MAX_EMBEDDED_WIDTH,
    MAX_PROJECT_LOGO_HEIGHT,
    MAX_PROJECT_LOGO_WIDTH,
)
from app.services.cache_service import cache_service
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service


class ProjectsService:
    def _cache_key_by_id(self, project_id: str) -> str:
        return cache_service.build_key(PROJECT_CACHE_POLICY.namespace, "id", project_id)

    def _cache_key_by_slug(self, owner_id: str, slug: str) -> str:
        return cache_service.build_key(
            PROJECT_CACHE_POLICY.namespace,
            "slug",
            owner_id,
            normalize_slug(slug),
        )

    def _cache_document(self, project: dict | None) -> None:
        if not project:
            return
        project_id = project.get("projectId")
        owner_id = project.get("ownerId")
        slug = project.get("slug")
        if project_id:
            cache_service.set(self._cache_key_by_id(project_id), project, PROJECT_CACHE_POLICY.ttl_seconds)
        if owner_id and slug:
            cache_service.set(
                self._cache_key_by_slug(owner_id, slug),
                project,
                PROJECT_CACHE_POLICY.ttl_seconds,
            )

    def invalidate_cache_entry(
        self,
        project_id: str,
        owner_id: str | None,
        old_slug: str | None,
        new_slug: str | None = None,
    ) -> None:
        keys = [self._cache_key_by_id(project_id)]
        if owner_id and old_slug:
            keys.append(self._cache_key_by_slug(owner_id, old_slug))
        if owner_id and new_slug:
            keys.append(self._cache_key_by_slug(owner_id, new_slug))
        cache_service.delete_many(*keys)

    def _propagate_project_visibility(self, project_id: str, is_public: bool) -> None:
        from app.services.collections_service import collections_service
        from app.services.papers_service import papers_service

        collections = firestore_store.find_by_fields("collections", {"projectId": project_id})
        for collection in collections:
            if collection.get("isPublic") == is_public:
                continue
            collection_id = collection.get("collectionId")
            if not collection_id:
                continue
            firestore_store.update(
                "collections",
                collection_id,
                {"isPublic": is_public, "updatedAt": utc_now()},
            )
            collections_service.invalidate_cache_entry(
                collection_id=collection_id,
                owner_id=collection.get("ownerId"),
                project_id=collection.get("projectId"),
                old_slug=collection.get("slug"),
                new_slug=collection.get("slug"),
            )
            collection["isPublic"] = is_public

        papers = papers_service.list_by_project_id(project_id)
        target_status = "published" if is_public else "draft"
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

    def _is_slug_conflict(self, owner_id: str, slug: str, project_id: str | None = None) -> bool:
        normalized = normalize_slug(slug)
        if not normalized:
            return True
        if is_reserved_project_slug(normalized):
            return True

        existing_projects = firestore_store.find_by_fields("projects", {"ownerId": owner_id, "slug": normalized})
        if any(project.get("projectId") != project_id for project in existing_projects):
            return True

        return False

    def _generate_unique_slug(self, owner_id: str, source: str) -> str:
        base = normalize_slug(source) or "project"
        if not self._is_slug_conflict(owner_id, base):
            return base

        for _ in range(20):
            suffix = uuid4().hex[:6]
            candidate = f"{base}-{suffix}"
            if not self._is_slug_conflict(owner_id, candidate):
                return candidate

        return f"{base}-{uuid4().hex[:8]}"

    def list_owned(self, owner_id: str) -> list[dict]:
        return firestore_store.find_by_fields("projects", {"ownerId": owner_id})

    def get_by_id(self, project_id: str) -> dict:
        cached = cache_service.get(self._cache_key_by_id(project_id))
        if isinstance(cached, dict):
            print("found in cache", flush=True)
            return cached

        print("not found in cache", flush=True)
        project = firestore_store.get("projects", project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
        self._cache_document(project)
        return project

    def get_by_slug(self, owner_id: str, project_slug: str) -> dict:
        cached = cache_service.get(self._cache_key_by_slug(owner_id, project_slug))
        if isinstance(cached, dict):
            return cached

        matches = firestore_store.find_by_fields(
            "projects",
            {"ownerId": owner_id, "slug": normalize_slug(project_slug)},
        )
        if not matches:
            raise HTTPException(status_code=404, detail="Project not found.")
        project = matches[0]
        self._cache_document(project)
        return project

    def create(self, owner_id: str, payload: dict) -> dict:
        project_id = str(uuid4())
        now = utc_now()
        payload["name"] = (payload.get("name") or "Untitled Project").strip() or "Untitled Project"
        payload["description"] = payload.get("description") or ""
        payload["logoUrl"] = payload.get("logoUrl") or None
        payload["pagesNumber"] = 0
        payload["isPublic"] = bool(payload.get("isPublic", True))
        payload["slug"] = self._generate_unique_slug(owner_id, payload["name"])
        payload["ownerId"] = owner_id
        payload["projectId"] = project_id
        payload["createdAt"] = now
        payload["updatedAt"] = now
        firestore_store.create("projects", payload, doc_id=project_id)
        return payload

    def update(self, project_id: str, owner_id: str, payload: dict) -> dict:
        current = firestore_store.get("projects", project_id)
        if not current:
            raise HTTPException(status_code=404, detail="Project not found.")
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        allowed_update_fields = {"name", "slug", "description", "logoUrl"}
        payload = {key: value for key, value in payload.items() if key in allowed_update_fields}

        if "name" in payload:
            payload["name"] = (payload.get("name") or "Untitled Project").strip() or "Untitled Project"

        if "description" in payload:
            payload["description"] = payload.get("description") or ""

        if "logoUrl" in payload and not payload.get("logoUrl"):
            payload["logoUrl"] = None

        if payload.get("slug"):
            new_slug = normalize_slug(payload["slug"])
            if self._is_slug_conflict(owner_id, new_slug, project_id):
                raise HTTPException(status_code=409, detail="Slug is not available.")
            payload["slug"] = new_slug

        if not payload:
            return current
        previous_slug = current.get("slug")
        payload["updatedAt"] = utc_now()
        firestore_store.update("projects", project_id, payload)
        current.update(payload)
        self.invalidate_cache_entry(project_id, current.get("ownerId"), previous_slug, current.get("slug"))
        return current

    async def upload_logo(
        self, project_id: str, owner_id: str, file: UploadFile
    ) -> dict[str, str]:
        project = self.get_by_id(project_id)
        if project.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        url = await storage_service.upload_image(
            f"users/{owner_id}/projects/{project_id}/logo",
            file,
            max_width=MAX_PROJECT_LOGO_WIDTH,
            max_height=MAX_PROJECT_LOGO_HEIGHT,
            crop=True,
            overwrite_name="logo",
        )
        return {"url": url}

    async def upload_embedded_image(
        self, project_id: str, owner_id: str, file: UploadFile
    ) -> dict[str, str]:
        project = self.get_by_id(project_id)
        if project.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        url = await storage_service.upload_image(
            f"users/{owner_id}/projects/{project_id}/embedded",
            file,
            max_width=MAX_EMBEDDED_WIDTH,
            max_height=MAX_EMBEDDED_HEIGHT,
            crop=False,
        )
        return {"url": url}

    def set_visibility(self, project_id: str, owner_id: str, is_public: bool) -> dict:
        current = self.get_by_id(project_id)
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        previous_slug = current.get("slug")
        payload = {"isPublic": target_visibility, "updatedAt": utc_now()}
        firestore_store.update("projects", project_id, payload)
        current.update(payload)
        self.invalidate_cache_entry(project_id, current.get("ownerId"), previous_slug, current.get("slug"))
        self._propagate_project_visibility(project_id, target_visibility)
        return current

    def delete(self, project_id: str, owner_id: str) -> dict[str, bool]:
        self.delete_with_dependencies(project_id, owner_id)
        return {"ok": True}

    def delete_with_dependencies(self, project_id: str, owner_id: str | None = None) -> None:
        current = self.get_by_id(project_id)
        if owner_id and current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        from app.services.collections_service import collections_service
        from app.services.papers_service import papers_service

        collections = firestore_store.find_by_fields("collections", {"projectId": project_id})
        for collection in collections:
            collection_id = collection.get("collectionId")
            if collection_id:
                collections_service.delete(collection_id, owner_id)

        papers = papers_service.list_by_project_id(project_id)
        for paper in papers:
            if paper.get("collectionId"):
                continue
            paper_id = paper.get("paperId")
            if paper_id:
                papers_service.delete(paper_id)

        resolved_owner_id = current.get("ownerId")
        if resolved_owner_id:
            storage_service.delete_project_assets(resolved_owner_id, project_id)
        firestore_store.delete("projects", project_id)
        self.invalidate_cache_entry(project_id, current.get("ownerId"), current.get("slug"))

    def is_slug_available(self, owner_id: str, slug: str, project_id: str | None = None) -> bool:
        return not self._is_slug_conflict(owner_id, slug, project_id)

    def recalculate_papers_number(self, project_id: str, owner_id: str) -> dict[str, bool]:
        from app.services.papers_service import papers_service

        project = self.get_by_id(project_id)
        if project.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
        papers = papers_service.list_owned(owner_id)
        papers_number = sum(1 for paper in papers if paper.get("projectId") == project_id)
        now = utc_now()
        firestore_store.update("projects", project_id, {"pagesNumber": papers_number, "updatedAt": now})
        self.invalidate_cache_entry(project_id, project.get("ownerId"), project.get("slug"))
        return {"ok": True}

projects_service = ProjectsService()
