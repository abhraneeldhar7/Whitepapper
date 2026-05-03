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
from app.core.reserved_paths import is_reserved_projectSlug
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

    def _get_ownerUsername(self, ownerId: str | None) -> str | None:
        if not ownerId:
            return None
        user_doc = firestore_store.get("users", ownerId)
        if not user_doc:
            return None
        return user_doc.get("username")

    @staticmethod
    def _is_public_project(project: dict | None) -> bool:
        return bool(project) and bool(project.get(PROJECT_PUBLIC_KEY))

    def _unique_slug(self, ownerId: str, source: str, excludeProjectId: str | None = None) -> str:
        base = normalize_slug(source) or "project"
        if is_reserved_projectSlug(base):
            base = f"{base}-project"

        owned_projects = self.list_owned(ownerId)

        candidate = base
        while True:
            is_taken = any(
                str(item.get(PROJECT_SLUG_KEY) or "").strip() == candidate
                and item.get(PROJECT_ID_KEY) != excludeProjectId
                for item in owned_projects
            )
            if not is_taken:
                return candidate
            candidate = f"{base}-{uuid4().hex[:4]}"

    def _propagate_project_visibility(self, projectId: str, is_public: bool) -> None:
        from app.services.collections_service import collections_service

        collections = firestore_store.find_by_fields("collections", {"projectId": projectId})
        for collection in collections:
            if collection.get("isPublic") == is_public:
                continue
            collectionId = collection.get("collectionId")
            if not collectionId:
                continue
            # Waterfall propagation: project -> collection -> papers.
            collections_service.set_visibility(collectionId, is_public, background=False)

    def _run_project_visibility_propagation(self, projectId: str, is_public: bool) -> None:
        try:
            self._propagate_project_visibility(projectId, is_public)
        except Exception:
            logger.exception(
                "Project visibility propagation failed for projectId=%s is_public=%s",
                projectId,
                is_public,
            )

    def _set_visibility_only(self, projectId: str, is_public: bool) -> dict:
        current = self.get_by_id(projectId)
        target_visibility = bool(is_public)
        if bool(current.get("isPublic", False)) == target_visibility:
            return current

        visibility_patch = {
            "isPublic": target_visibility,
            "updatedAt": utc_now(),
        }
        firestore_store.update(PROJECTS_COLLECTION, projectId, visibility_patch)
        current.update(visibility_patch)
        return current

    def list_owned(self, ownerId: str, public: bool = False) -> list[dict]:
        items = firestore_store.find_by_fields(PROJECTS_COLLECTION, {PROJECT_OWNER_KEY: ownerId})
        if public:
            return [item for item in items if bool(item.get(PROJECT_PUBLIC_KEY))]
        return items

    def list_owned_paginated(
        self,
        ownerId: str,
        *,
        public: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_owned(ownerId, public=public)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_all_public(self) -> list[dict]:
        return firestore_store.find_by_fields(PROJECTS_COLLECTION, {PROJECT_PUBLIC_KEY: True})

    def get_many_by_ids(self, projectIds: list[str]) -> list[dict]:
        return firestore_store.get_many(PROJECTS_COLLECTION, projectIds)

    def get_by_id(self, projectId: str, public: bool = False) -> dict:
        project = firestore_store.get(PROJECTS_COLLECTION, projectId)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
        if public and not self._is_public_project(project):
            raise HTTPException(status_code=404, detail="Project not found.")
        return project

    def get_by_slug(self, ownerUsername: str, projectSlug: str, public: bool = False) -> dict:
        from app.services.user_service import user_service

        try:
            owner = user_service.get_by_username(ownerUsername)
        except HTTPException as exc:
            if exc.status_code == 404:
                raise HTTPException(status_code=404, detail="Project not found.") from None
            raise

        ownerId = owner.get("userId")
        if not ownerId:
            raise HTTPException(status_code=404, detail="Project not found.")

        matches = [
            item
            for item in self.list_owned(ownerId, public=public)
            if str(item.get(PROJECT_SLUG_KEY) or "").strip() == projectSlug
        ]
        if not matches:
            raise HTTPException(status_code=404, detail="Project not found.")
        return matches[0]

    def create(self, ownerId: str, payload: dict) -> dict:
        owned_projects = self.list_owned(ownerId)
        if len(owned_projects) >= MAX_PROJECTS_PER_USER:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Project limit reached ({MAX_PROJECTS_PER_USER}). "
                    "Delete an existing project to create a new one."
                ),
            )

        projectId = str(uuid4())
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
            PROJECT_ID_KEY: projectId,
            PROJECT_OWNER_KEY: ownerId,
            "name": name,
            PROJECT_SLUG_KEY: self._unique_slug(ownerId, payload.get("slug") or name),
            "description": description,
            "contentGuidelines": content_guidelines,
            "logoUrl": payload.get("logoUrl") or None,
            "isPublic": bool(payload.get("isPublic", True)),
            "pagesNumber": 0,
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(PROJECTS_COLLECTION, created, doc_id=projectId)
        return created

    def update(self, projectId: str, payload: dict) -> dict:
        current = self.get_by_id(projectId)

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
            if any(item.get(PROJECT_ID_KEY) != projectId for item in matches):
                raise HTTPException(status_code=409, detail="Slug is not available.")
            payload["slug"] = new_slug

        if not payload:
            return current

        payload["updatedAt"] = utc_now()
        firestore_store.update(PROJECTS_COLLECTION, projectId, payload)
        current.update(payload)
        return current

    async def upload_logo(self, projectId: str, file: UploadFile) -> dict[str, str]:
        project = self.get_by_id(projectId)
        ownerId = project.get(PROJECT_OWNER_KEY)
        if not ownerId:
            raise HTTPException(status_code=400, detail="Project owner is missing.")
        url = await storage_service.upload_image(
            f"users/{ownerId}/projects/{projectId}/logo",
            file,
            max_width=MAX_PROJECT_LOGO_WIDTH,
            max_height=MAX_PROJECT_LOGO_HEIGHT,
            crop=True,
            overwrite_name="logo",
        )
        url = add_cache_buster(url)
        self.update(projectId, {"logoUrl": url})
        return {"url": url}

    async def upload_embedded_image(self, projectId: str, file: UploadFile) -> dict[str, str]:
        project = self.get_by_id(projectId)
        ownerId = project.get(PROJECT_OWNER_KEY)
        if not ownerId:
            raise HTTPException(status_code=400, detail="Project owner is missing.")
        url = await storage_service.upload_image(
            f"users/{ownerId}/projects/{projectId}/embedded",
            file,
            max_width=MAX_EMBEDDED_WIDTH,
            max_height=MAX_EMBEDDED_HEIGHT,
            crop=False,
        )
        return {"url": url}

    def delete_project_logo(self, projectId: str) -> bool:
        project = self.get_by_id(projectId)
        ownerId = project.get(PROJECT_OWNER_KEY)
        if not ownerId:
            return False
        base = f"users/{ownerId}/projects/{projectId}/logo/logo"
        deleted = storage_service.delete_first_existing(
            [base, *[f"{base}{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]]
        )
        if deleted:
            self.update(projectId, {"logoUrl": None})
        return deleted

    def delete_unused_project_embedded_images(self, ownerId: str, projectId: str, used_urls: set[str]) -> int:
        return storage_service.delete_unreferenced_blobs(
            f"users/{ownerId}/projects/{projectId}/embedded/",
            used_urls,
        )

    def delete_project_assets(self, ownerId: str, projectId: str) -> int:
        return storage_service.delete_by_prefix(f"users/{ownerId}/projects/{projectId}/")

    def set_visibility(self, projectId: str, is_public: bool, *, background: bool = True) -> dict:
        updated = self._set_visibility_only(projectId, is_public)
        target_visibility = bool(updated.get("isPublic", False))

        if background:
            worker = threading.Thread(
                target=self._run_project_visibility_propagation,
                args=(projectId, target_visibility),
                daemon=True,
            )
            worker.start()
        else:
            self._run_project_visibility_propagation(projectId, target_visibility)

        return updated

    def delete_cascade(self, projectId: str) -> dict[str, int]:
        current = self.get_by_id(projectId)

        from app.services.collections_service import collections_service
        from app.services.papers_service import papers_service
        from app.services.dev_api_service import dev_api_service

        deleted_counts: dict[str, int] = {
            "projects": 0,
            "collections": 0,
            "papers": 0,
            "apiKeys": 0,
            "storageObjects": 0,
        }

        for paper in papers_service.list_by_projectId(projectId, standalone=True):
            result = papers_service.delete_cascade(paper["paperId"])
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        for collection in collections_service.list_project_collections(projectId):
            result = collections_service.delete_cascade(collection["collectionId"])
            deleted_counts["collections"] += result.get("collections", 0)
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        deleted_counts["apiKeys"] += dev_api_service.delete_by_project(projectId)

        ownerId = current.get(PROJECT_OWNER_KEY)
        if ownerId:
            deleted_counts["storageObjects"] += self.delete_project_assets(ownerId, projectId)
        firestore_store.delete(PROJECTS_COLLECTION, projectId)
        deleted_counts["projects"] = 1
        return deleted_counts

    def delete(self, projectId: str) -> dict[str, bool]:
        self.delete_cascade(projectId)
        return {"ok": True}

    def is_slug_available(self, ownerId: str, slug: str, projectId: str | None = None) -> bool:
        candidate = normalize_slug(slug or "")
        if not candidate or is_reserved_projectSlug(candidate):
            return False
        matches = [
            item
            for item in self.list_owned(ownerId)
            if str(item.get(PROJECT_SLUG_KEY) or "").strip() == candidate
        ]
        return all(item.get(PROJECT_ID_KEY) == projectId for item in matches)

projects_service = ProjectsService()
