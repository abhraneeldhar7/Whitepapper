import logging
import pickle
import threading
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.cache_policies import PROJECT_CACHE_POLICY
from app.core.constants import (
    MAX_EMBEDDED_HEIGHT,
    MAX_EMBEDDED_WIDTH,
    MAX_PROJECT_LOGO_HEIGHT,
    MAX_PROJECT_LOGO_WIDTH,
)
from app.core.firestore_store import firestore_store, utc_now
from app.core.redis_client import get_cache_prefix, get_redis_client
from app.core.reserved_paths import is_reserved_project_slug
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service
from app.utils.cache import add_cache_buster

logger = logging.getLogger(__name__)

PROJECTS_COLLECTION = "projects"
PROJECT_ID_KEY = "projectId"
PROJECT_SLUG_KEY = "slug"
PROJECT_OWNER_KEY = "ownerId"
PROJECT_PUBLIC_KEY = "isPublic"
SUPPORTED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")


class ProjectsService:
    def _project_by_id_key(self, project_id: str) -> str:
        return f"{get_cache_prefix()}:projects:id:{project_id}"

    def _project_by_slug_key(self, owner_username: str, slug: str) -> str:
        return f"{get_cache_prefix()}:projects:slug:{owner_username}:{slug}"

    def _load_cached_project(self, key: str) -> dict | None:
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
            logger.exception("Project cache read failed for key=%s", key)
            return None

    def _set_cached_project(self, project: dict) -> None:
        client = get_redis_client()
        if not client:
            return

        project_id = project.get(PROJECT_ID_KEY)
        owner_username = self._get_owner_username(project.get(PROJECT_OWNER_KEY))
        slug = project.get(PROJECT_SLUG_KEY)
        if not project_id and not (owner_username and slug):
            return

        try:
            if project_id:
                client.setex(
                    self._project_by_id_key(project_id),
                    PROJECT_CACHE_POLICY.ttl_seconds,
                    pickle.dumps(project),
                )
            if owner_username and slug:
                client.setex(
                    self._project_by_slug_key(owner_username, slug),
                    PROJECT_CACHE_POLICY.ttl_seconds,
                    pickle.dumps(project),
                )
        except Exception:
            logger.exception("Project cache write failed for project_id=%s", project_id)

    def invalidate_project(self, project_id: str, owner_username: str | None = None, slug: str | None = None) -> None:
        client = get_redis_client()
        if not client:
            return

        keys = [self._project_by_id_key(project_id)]
        if owner_username and slug:
            keys.append(self._project_by_slug_key(owner_username, slug))
        try:
            client.delete(*keys)
        except Exception:
            logger.exception("Project cache invalidation failed for keys=%s", keys)

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

        candidate = base
        while True:
            matches = firestore_store.find_by_fields(
                PROJECTS_COLLECTION,
                {PROJECT_OWNER_KEY: owner_id, PROJECT_SLUG_KEY: candidate},
            )
            if all(item.get(PROJECT_ID_KEY) == exclude_project_id for item in matches):
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
        filters: dict[str, object] = {PROJECT_OWNER_KEY: owner_id}
        if public:
            filters[PROJECT_PUBLIC_KEY] = True
        return firestore_store.find_by_fields(PROJECTS_COLLECTION, filters)

    def list_all_public(self) -> list[dict]:
        return firestore_store.find_by_fields(PROJECTS_COLLECTION, {PROJECT_PUBLIC_KEY: True})

    def get_by_id(self, project_id: str, public: bool = False) -> dict:
        cached = self._load_cached_project(self._project_by_id_key(project_id))
        if cached:
            if public and not self._is_public_project(cached):
                raise HTTPException(status_code=404, detail="Project not found.")
            return cached

        project = firestore_store.get(PROJECTS_COLLECTION, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
        if public and not self._is_public_project(project):
            raise HTTPException(status_code=404, detail="Project not found.")
        self._set_cached_project(project)
        return project

    def get_by_slug(self, owner_username: str, project_slug: str, public: bool = False) -> dict:
        cached = self._load_cached_project(self._project_by_slug_key(owner_username, project_slug))
        if cached:
            if public and not self._is_public_project(cached):
                raise HTTPException(status_code=404, detail="Project not found.")
            return cached

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

        filters: dict[str, object] = {PROJECT_OWNER_KEY: owner_id, PROJECT_SLUG_KEY: project_slug}
        if public:
            filters[PROJECT_PUBLIC_KEY] = True
        matches = firestore_store.find_by_fields(PROJECTS_COLLECTION, filters)
        if not matches:
            raise HTTPException(status_code=404, detail="Project not found.")
        project = matches[0]
        self._set_cached_project(project)
        return project

    def create(self, owner_id: str, payload: dict) -> dict:
        project_id = str(uuid4())
        now = utc_now()
        name = (payload.get("name") or "Untitled Project").strip() or "Untitled Project"
        created = {
            PROJECT_ID_KEY: project_id,
            PROJECT_OWNER_KEY: owner_id,
            "name": name,
            PROJECT_SLUG_KEY: self._unique_slug(owner_id, payload.get("slug") or name),
            "description": payload.get("description") or "",
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

        allowed_update_fields = {"name", "slug", "description", "logoUrl", "isPublic", "pagesNumber"}
        payload = {key: value for key, value in payload.items() if key in allowed_update_fields}

        if "name" in payload:
            payload["name"] = (payload.get("name") or "Untitled Project").strip() or "Untitled Project"
        if "description" in payload:
            payload["description"] = payload.get("description") or ""
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
            matches = firestore_store.find_by_fields(
                PROJECTS_COLLECTION,
                {PROJECT_OWNER_KEY: current.get(PROJECT_OWNER_KEY), PROJECT_SLUG_KEY: new_slug},
            )
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

    def delete(self, project_id: str) -> dict[str, bool]:
        current = self.get_by_id(project_id)

        from app.services.collections_service import collections_service
        from app.services.papers_service import papers_service

        collections = firestore_store.find_by_fields("collections", {"projectId": project_id})
        for collection in collections:
            collections_service.delete(collection["collectionId"])

        papers = papers_service.list_by_project_id(project_id)
        for paper in papers:
            if paper.get("collectionId"):
                continue
            papers_service.delete(paper["paperId"])

        owner_id = current.get(PROJECT_OWNER_KEY)
        if owner_id:
            self.delete_project_assets(owner_id, project_id)
        firestore_store.delete(PROJECTS_COLLECTION, project_id)
        self.invalidate_project(
            project_id=project_id,
            owner_username=self._get_owner_username(current.get(PROJECT_OWNER_KEY)),
            slug=current.get(PROJECT_SLUG_KEY),
        )
        return {"ok": True}

    def is_slug_available(self, owner_id: str, slug: str, project_id: str | None = None) -> bool:
        candidate = normalize_slug(slug or "")
        if not candidate or is_reserved_project_slug(candidate):
            return False
        matches = firestore_store.find_by_fields(
            PROJECTS_COLLECTION,
            {PROJECT_OWNER_KEY: owner_id, PROJECT_SLUG_KEY: candidate},
        )
        return all(item.get(PROJECT_ID_KEY) == project_id for item in matches)


projects_service = ProjectsService()
