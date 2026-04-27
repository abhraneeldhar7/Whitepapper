import logging
import threading
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.constants import (
    MAX_EMBEDDED_HEIGHT,
    MAX_EMBEDDED_WIDTH,
    MAX_PROJECT_LOGO_HEIGHT,
    MAX_PROJECT_LOGO_WIDTH,
)
from app.core.limits import MAX_DESCRIPTION_LENGTH, MAX_PROJECTS_PER_USER
from app.core.firestore_store import firestore_store
from app.core.reserved_paths import is_reserved_project_slug
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service
from app.utils.cache import add_cache_buster
from app.utils.datetime import utc_now
from app.utils.pagination import apply_order_by, paginate_items

logger = logging.getLogger(__name__)

PROJECTS_COLLECTION = "projects"
PROJECT_ID_KEY = "projectId"
PROJECT_SLUG_KEY = "slug"
PROJECT_OWNER_KEY = "ownerId"
PROJECT_PUBLIC_KEY = "isPublic"
SUPPORTED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
class ProjectsService:

    def invalidate_project(self, project_id: str, owner_username: str | None = None, slug: str | None = None) -> None:
        return None

    def _get_owner_username(self, owner_id: str | None) -> str | None:
        if not owner_id:
            return None
        user_doc = firestore_store.get("users", owner_id)
        if not user_doc:
            return None
        return user_doc.get("username")

    @staticmethod
    def _is_public_project(project: dict | None) -> bool:
        return bool(project) and bool(project.get(PROJECT_PUBLIC_KEY))

    def _unique_slug(self, owner_id: str, source: str, exclude_project_id: str | None = None) -> str:
        base = normalize_slug(source) or "project"
        if is_reserved_project_slug(base):
            base = f"{base}-project"

        owned_projects = self.list_owned(owner_id)

        candidate = base
        while True:
            is_taken = any(
                str(item.get(PROJECT_SLUG_KEY) or "").strip() == candidate
                and item.get(PROJECT_ID_KEY) != exclude_project_id
                for item in owned_projects
            )
            if not is_taken:
                return candidate
            candidate = f"{base}-{uuid4().hex[:4]}"

    def _propagate_project_visibility(self, project_id: str, is_public: bool) -> None:
        from app.services.collections_service import collections_service

        collections = firestore_store.find_by_fields("collections", {"projectId": project_id})
        for collection in collections:
            if collection.get("isPublic") == is_public:
                continue
            collection_id = collection.get("collectionId")
            if not collection_id:
                continue
            # Waterfall propagation: project -> collection -> papers.
            collections_service.set_visibility(collection_id, is_public, background=False)

    def _run_project_visibility_propagation(self, project_id: str, is_public: bool) -> None:
        try:
            self._propagate_project_visibility(project_id, is_public)
        except Exception:
            logger.exception(
                "Project visibility propagation failed for project_id=%s is_public=%s",
                project_id,
                is_public,
            )

    def _set_visibility_only(self, project_id: str, is_public: bool) -> dict:
        current = self.get_by_id(project_id)
        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        previous_slug = current.get(PROJECT_SLUG_KEY)
        owner_username = self._get_owner_username(current.get(PROJECT_OWNER_KEY))
        visibility_patch = {
            "isPublic": target_visibility,
            "updatedAt": utc_now(),
        }
        firestore_store.update(PROJECTS_COLLECTION, project_id, visibility_patch)
        current.update(visibility_patch)
        self.invalidate_project(project_id=project_id, owner_username=owner_username, slug=previous_slug)
        return current

    def list_owned(self, owner_id: str, public: bool = False) -> list[dict]:
        items = firestore_store.find_by_fields(PROJECTS_COLLECTION, {PROJECT_OWNER_KEY: owner_id})
        if public:
            return [item for item in items if bool(item.get(PROJECT_PUBLIC_KEY))]
        return items

    def list_owned_paginated(
        self,
        owner_id: str,
        *,
        public: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_owned(owner_id, public=public)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_all_public(self) -> list[dict]:
        return firestore_store.find_by_fields(PROJECTS_COLLECTION, {PROJECT_PUBLIC_KEY: True})

    def get_many_by_ids(self, project_ids: list[str]) -> list[dict]:
        return firestore_store.get_many(PROJECTS_COLLECTION, project_ids)

    def get_by_id(self, project_id: str, public: bool = False) -> dict:
        project = firestore_store.get(PROJECTS_COLLECTION, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
        if public and not self._is_public_project(project):
            raise HTTPException(status_code=404, detail="Project not found.")
        return project

    def get_by_slug(self, owner_username: str, project_slug: str, public: bool = False) -> dict:
        from app.services.user_service import user_service

        try:
            owner = user_service.get_by_username(owner_username)
        except HTTPException as exc:
            if exc.status_code == 404:
                raise HTTPException(status_code=404, detail="Project not found.") from None
            raise

        owner_id = owner.get("userId")
        if not owner_id:
            raise HTTPException(status_code=404, detail="Project not found.")

        matches = [
            item
            for item in self.list_owned(owner_id, public=public)
            if str(item.get(PROJECT_SLUG_KEY) or "").strip() == project_slug
        ]
        if not matches:
            raise HTTPException(status_code=404, detail="Project not found.")
        return matches[0]

    def create(self, owner_id: str, payload: dict) -> dict:
        owned_projects = self.list_owned(owner_id)
        if len(owned_projects) >= MAX_PROJECTS_PER_USER:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Project limit reached ({MAX_PROJECTS_PER_USER}). "
                    "Delete an existing project to create a new one."
                ),
            )

        project_id = str(uuid4())
        now = utc_now()
        name = (payload.get("name") or "Untitled Project").strip() or "Untitled Project"
        description = payload.get("description") or ""
        if len(description) > MAX_DESCRIPTION_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Project description is too long. "
                    f"Maximum length is {MAX_DESCRIPTION_LENGTH} characters."
                ),
            )
        content_guidelines = payload.get("contentGuidelines") or ""
        if len(content_guidelines) > MAX_DESCRIPTION_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Project content guidelines are too long. "
                    f"Maximum length is {MAX_DESCRIPTION_LENGTH} characters."
                ),
            )

        created = {
            PROJECT_ID_KEY: project_id,
            PROJECT_OWNER_KEY: owner_id,
            "name": name,
            PROJECT_SLUG_KEY: self._unique_slug(owner_id, payload.get("slug") or name),
            "description": description,
            "contentGuidelines": content_guidelines,
            "logoUrl": payload.get("logoUrl") or None,
            "isPublic": bool(payload.get("isPublic", True)),
            "pagesNumber": 0,
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(PROJECTS_COLLECTION, created, doc_id=project_id)
        return created

    def update(self, project_id: str, payload: dict) -> dict:
        current = self.get_by_id(project_id)

        allowed_update_fields = {"name", "slug", "description", "contentGuidelines", "logoUrl", "isPublic", "pagesNumber"}
        payload = {key: value for key, value in payload.items() if key in allowed_update_fields}

        if "name" in payload:
            payload["name"] = (payload.get("name") or "Untitled Project").strip() or "Untitled Project"
        if "description" in payload:
            payload["description"] = payload.get("description") or ""
            if len(payload["description"]) > MAX_DESCRIPTION_LENGTH:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Project description is too long. "
                        f"Maximum length is {MAX_DESCRIPTION_LENGTH} characters."
                    ),
                )
        if "contentGuidelines" in payload:
            payload["contentGuidelines"] = payload.get("contentGuidelines") or ""
            if len(payload["contentGuidelines"]) > MAX_DESCRIPTION_LENGTH:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Project content guidelines are too long. "
                        f"Maximum length is {MAX_DESCRIPTION_LENGTH} characters."
                    ),
                )
        if "logoUrl" in payload and not payload.get("logoUrl"):
            payload["logoUrl"] = None
        if "isPublic" in payload:
            payload["isPublic"] = bool(payload.get("isPublic"))
        if "pagesNumber" in payload:
            payload["pagesNumber"] = int(payload.get("pagesNumber") or 0)
        if "slug" in payload:
            new_slug = normalize_slug(payload.get("slug") or "")
            if not new_slug:
                raise HTTPException(status_code=400, detail="Invalid slug.")
            matches = [
                item
                for item in self.list_owned(str(current.get(PROJECT_OWNER_KEY) or ""))
                if str(item.get(PROJECT_SLUG_KEY) or "").strip() == new_slug
            ]
            if any(item.get(PROJECT_ID_KEY) != project_id for item in matches):
                raise HTTPException(status_code=409, detail="Slug is not available.")
            payload["slug"] = new_slug

        if not payload:
            return current

        previous_slug = current.get(PROJECT_SLUG_KEY)
        owner_username = self._get_owner_username(current.get(PROJECT_OWNER_KEY))
        payload["updatedAt"] = utc_now()
        firestore_store.update(PROJECTS_COLLECTION, project_id, payload)
        current.update(payload)
        self.invalidate_project(project_id=project_id, owner_username=owner_username, slug=previous_slug)
        return current

    async def upload_logo(self, project_id: str, file: UploadFile) -> dict[str, str]:
        project = self.get_by_id(project_id)
        owner_id = project.get(PROJECT_OWNER_KEY)
        if not owner_id:
            raise HTTPException(status_code=400, detail="Project owner is missing.")
        url = await storage_service.upload_image(
            f"users/{owner_id}/projects/{project_id}/logo",
            file,
            max_width=MAX_PROJECT_LOGO_WIDTH,
            max_height=MAX_PROJECT_LOGO_HEIGHT,
            crop=True,
            overwrite_name="logo",
        )
        url = add_cache_buster(url)
        self.update(project_id, {"logoUrl": url})
        return {"url": url}

    async def upload_embedded_image(self, project_id: str, file: UploadFile) -> dict[str, str]:
        project = self.get_by_id(project_id)
        owner_id = project.get(PROJECT_OWNER_KEY)
        if not owner_id:
            raise HTTPException(status_code=400, detail="Project owner is missing.")
        url = await storage_service.upload_image(
            f"users/{owner_id}/projects/{project_id}/embedded",
            file,
            max_width=MAX_EMBEDDED_WIDTH,
            max_height=MAX_EMBEDDED_HEIGHT,
            crop=False,
        )
        return {"url": url}

    def delete_project_logo(self, project_id: str) -> bool:
        project = self.get_by_id(project_id)
        owner_id = project.get(PROJECT_OWNER_KEY)
        if not owner_id:
            return False
        base = f"users/{owner_id}/projects/{project_id}/logo/logo"
        deleted = storage_service.delete_first_existing(
            [base, *[f"{base}{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]]
        )
        if deleted:
            self.update(project_id, {"logoUrl": None})
        return deleted

    def delete_unused_project_embedded_images(self, owner_id: str, project_id: str, used_urls: set[str]) -> int:
        return storage_service.delete_unreferenced_blobs(
            f"users/{owner_id}/projects/{project_id}/embedded/",
            used_urls,
        )

    def delete_project_assets(self, owner_id: str, project_id: str) -> int:
        return storage_service.delete_by_prefix(f"users/{owner_id}/projects/{project_id}/")

    def set_visibility(self, project_id: str, is_public: bool, *, background: bool = True) -> dict:
        updated = self._set_visibility_only(project_id, is_public)
        target_visibility = bool(updated.get("isPublic", False))

        if background:
            worker = threading.Thread(
                target=self._run_project_visibility_propagation,
                args=(project_id, target_visibility),
                daemon=True,
            )
            worker.start()
        else:
            self._run_project_visibility_propagation(project_id, target_visibility)

        return updated

    def delete_cascade(self, project_id: str) -> dict[str, int]:
        current = self.get_by_id(project_id)

        from app.services.collections_service import collections_service
        from app.services.papers_service import papers_service
        from app.services._dev_api_service import _dev_api_service

        deleted_counts = {
            "projects": 0,
            "collections": 0,
            "papers": 0,
            "apiKeys": 0,
            "storageObjects": 0,
        }
        collections = firestore_store.find_by_fields("collections", {"projectId": project_id})
        for collection in collections:
            result = collections_service.delete_cascade(collection["collectionId"])
            deleted_counts["collections"] += result.get("collections", 0)
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        papers = papers_service.list_by_project_id(project_id)
        for paper in papers:
            if paper.get("collectionId"):
                continue
            result = papers_service.delete_cascade(paper["paperId"])
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        deleted_counts["apiKeys"] += _dev_api_service.delete_by_project(project_id)

        owner_id = current.get(PROJECT_OWNER_KEY)
        if owner_id:
            deleted_counts["storageObjects"] += self.delete_project_assets(owner_id, project_id)
        firestore_store.delete(PROJECTS_COLLECTION, project_id)
        self.invalidate_project(
            project_id=project_id,
            owner_username=self._get_owner_username(current.get(PROJECT_OWNER_KEY)),
            slug=current.get(PROJECT_SLUG_KEY),
        )
        deleted_counts["projects"] = 1
        return deleted_counts

    def delete(self, project_id: str) -> dict[str, bool]:
        self.delete_cascade(project_id)
        return {"ok": True}

    def is_slug_available(self, owner_id: str, slug: str, project_id: str | None = None) -> bool:
        candidate = normalize_slug(slug or "")
        if not candidate or is_reserved_project_slug(candidate):
            return False
        matches = [
            item
            for item in self.list_owned(owner_id)
            if str(item.get(PROJECT_SLUG_KEY) or "").strip() == candidate
        ]
        return all(item.get(PROJECT_ID_KEY) == project_id for item in matches)


projects_service = ProjectsService()
