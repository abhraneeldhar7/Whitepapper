import logging
import pickle
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.cache_policies import PAPER_CACHE_POLICY
from app.core.constants import (
    MAX_EMBEDDED_HEIGHT,
    MAX_EMBEDDED_WIDTH,
    MAX_THUMBNAIL_HEIGHT,
    MAX_THUMBNAIL_WIDTH,
)
from app.core.firestore_store import firestore_store, utc_now
from app.core.redis_client import get_cache_prefix, get_redis_client
from app.core.reserved_paths import is_reserved_paper_slug
from app.services.paper_metadata_service import paper_metadata_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service
from app.utils.cache import add_cache_buster

logger = logging.getLogger(__name__)

PAPERS_COLLECTION = "papers"
PAPER_ID_KEY = "paperId"
PAPER_OWNER_KEY = "ownerId"
PAPER_SLUG_KEY = "slug"
PAPER_PROJECT_KEY = "projectId"
PAPER_COLLECTION_KEY = "collectionId"
PAPER_STATUS_KEY = "status"
PAPER_STATUS_PUBLISHED = "published"
SUPPORTED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
METADATA_IMAGE_FIELDS = ("ogImage", "twitterImage", "coverImageUrl")


class PapersService:
    def _paper_by_id_key(self, paper_id: str) -> str:
        return f"{get_cache_prefix()}:papers:id:{paper_id}"

    def _paper_by_slug_key(self, owner_username: str, slug: str) -> str:
        return f"{get_cache_prefix()}:papers:slug:{owner_username}:{slug}"

    def _paper_by_project_slug_key(self, project_id: str, slug: str) -> str:
        return f"{get_cache_prefix()}:papers:project_slug:{project_id}:{slug}"

    @staticmethod
    def _normalize_owner_username(owner_username: str | None) -> str:
        resolved = (owner_username or "").strip().lower()
        if "@" in resolved:
            return ""
        return resolved

    @staticmethod
    def _normalize_paper_slug(paper_slug: str | None) -> str:
        return normalize_slug(paper_slug or "")

    @staticmethod
    def _is_public_paper(paper: dict | None) -> bool:
        return bool(paper) and paper.get(PAPER_STATUS_KEY) == PAPER_STATUS_PUBLISHED

    @staticmethod
    def _first_or_none(items: list[dict]) -> dict | None:
        return items[0] if items else None

    @staticmethod
    def _resolve_author_doc(owner_id: str | None) -> dict | None:
        if not owner_id:
            return None
        from app.services.user_service import user_service

        try:
            return user_service.get_by_id(owner_id)
        except HTTPException:
            return None

    @staticmethod
    def _resolve_project_doc(project_id: str | None) -> dict | None:
        if not project_id:
            return None
        try:
            return projects_service.get_by_id(project_id)
        except HTTPException:
            return None

    def _build_metadata(self, paper_doc: dict) -> dict:
        return paper_metadata_service.build_metadata(
            paper_doc=paper_doc,
            author_doc=self._resolve_author_doc(paper_doc.get(PAPER_OWNER_KEY)),
            project_doc=self._resolve_project_doc(paper_doc.get(PAPER_PROJECT_KEY)),
        )

    def _load_cached_paper(self, key: str) -> dict | None:
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
            logger.exception("Paper cache read failed for key=%s", key)
            return None

    def _set_cached_paper(
        self,
        paper: dict,
        *,
        owner_username: str | None = None,
        project_id: str | None = None,
    ) -> None:
        client = get_redis_client()
        if not client:
            return

        paper_id = paper.get(PAPER_ID_KEY)
        slug = self._normalize_paper_slug(paper.get(PAPER_SLUG_KEY))
        normalized_owner_username = self._normalize_owner_username(owner_username)
        normalized_project_id = str(project_id or paper.get(PAPER_PROJECT_KEY) or "").strip()
        if not paper_id and not (normalized_owner_username and slug) and not (normalized_project_id and slug):
            return

        try:
            if paper_id:
                client.setex(
                    self._paper_by_id_key(paper_id),
                    PAPER_CACHE_POLICY.ttl_seconds,
                    pickle.dumps(paper),
                )
            if normalized_owner_username and slug:
                client.setex(
                    self._paper_by_slug_key(normalized_owner_username, slug),
                    PAPER_CACHE_POLICY.ttl_seconds,
                    pickle.dumps(paper),
                )
            if normalized_project_id and slug:
                client.setex(
                    self._paper_by_project_slug_key(normalized_project_id, slug),
                    PAPER_CACHE_POLICY.ttl_seconds,
                    pickle.dumps(paper),
                )
        except Exception:
            logger.exception("Paper cache write failed for paper_id=%s", paper_id)

    def invalidate_paper(
        self,
        paper_id: str,
        owner_username: str | None = None,
        slug: str | None = None,
        project_id: str | None = None,
    ) -> None:
        client = get_redis_client()
        if not client:
            return

        keys = [self._paper_by_id_key(paper_id)]
        normalized_slug = self._normalize_paper_slug(slug)
        normalized_owner_username = self._normalize_owner_username(owner_username)
        normalized_project_id = str(project_id or "").strip()
        if normalized_owner_username and normalized_slug:
            keys.append(self._paper_by_slug_key(normalized_owner_username, normalized_slug))
        if normalized_project_id and normalized_slug:
            keys.append(self._paper_by_project_slug_key(normalized_project_id, normalized_slug))
        try:
            client.delete(*keys)
        except Exception:
            logger.exception("Paper cache invalidation failed for keys=%s", keys)

    def _refresh_collection_pages_number(self, collection_id: str) -> None:
        from app.services.collections_service import collections_service

        papers = self.list_by_collection_id(collection_id)
        now = utc_now()
        firestore_store.update(
            "collections",
            collection_id,
            {"pagesNumber": len(papers), "updatedAt": now},
        )
        collection = firestore_store.get("collections", collection_id)
        if not collection:
            return
        collections_service.invalidate_collection(
            collection_id=collection_id,
            project_id=collection.get("projectId"),
            slug=collection.get("slug"),
        )

    def _refresh_project_pages_number(self, project_id: str) -> None:
        papers = self.list_by_project_id(project_id)
        try:
            projects_service.update(project_id, {"pagesNumber": len(papers)})
        except HTTPException as exc:
            if exc.status_code != 404:
                raise

    def list_owned(self, owner_id: str, public: bool = False) -> list[dict]:
        filters: dict[str, object] = {PAPER_OWNER_KEY: owner_id}
        if public:
            filters[PAPER_STATUS_KEY] = PAPER_STATUS_PUBLISHED
        return firestore_store.find_by_fields(PAPERS_COLLECTION, filters)

    def list_standalone(self, owner_id: str, public: bool = False) -> list[dict]:
        return self.list_owned_filtered(owner_id=owner_id, standalone=True, public=public)

    def list_owned_filtered(
        self,
        owner_id: str,
        project_id: str | None = None,
        standalone: bool = False,
        public: bool = False,
    ) -> list[dict]:
        filters: dict[str, object] = {PAPER_OWNER_KEY: owner_id}
        if project_id:
            filters[PAPER_PROJECT_KEY] = project_id
            if standalone:
                filters[PAPER_COLLECTION_KEY] = None
        elif standalone:
            filters[PAPER_PROJECT_KEY] = None

        if public:
            filters[PAPER_STATUS_KEY] = PAPER_STATUS_PUBLISHED

        return firestore_store.find_by_fields(PAPERS_COLLECTION, filters)

    def list_by_project_id(self, project_id: str, public: bool = False, standalone: bool = False) -> list[dict]:
        filters: dict[str, object] = {PAPER_PROJECT_KEY: project_id}
        if standalone:
            filters[PAPER_COLLECTION_KEY] = None
        if public:
            filters[PAPER_STATUS_KEY] = PAPER_STATUS_PUBLISHED
        return firestore_store.find_by_fields(PAPERS_COLLECTION, filters)

    def list_by_collection_id(self, collection_id: str, public: bool = False) -> list[dict]:
        filters: dict[str, object] = {PAPER_COLLECTION_KEY: collection_id}
        if public:
            filters[PAPER_STATUS_KEY] = PAPER_STATUS_PUBLISHED
        return firestore_store.find_by_fields(PAPERS_COLLECTION, filters)

    def list_all_public(self) -> list[dict]:
        return firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_STATUS_KEY: PAPER_STATUS_PUBLISHED})

    def get_by_id(self, paper_id: str, public: bool = False) -> dict | None:
        cached = self._load_cached_paper(self._paper_by_id_key(paper_id))
        if cached:
            return cached if not public or self._is_public_paper(cached) else None

        paper = firestore_store.get(PAPERS_COLLECTION, paper_id)
        if paper:
            self._set_cached_paper(paper)
            if public and not self._is_public_paper(paper):
                return None
        return paper

    def _get_by_owner_slug(
        self,
        owner_id: str,
        paper_slug: str,
        *,
        public: bool = False,
        owner_username_for_cache: str | None = None,
    ) -> dict | None:
        slug = self._normalize_paper_slug(paper_slug)
        if not owner_id or not slug:
            return None

        filters: dict[str, object] = {PAPER_OWNER_KEY: owner_id, PAPER_SLUG_KEY: slug}
        if public:
            filters[PAPER_STATUS_KEY] = PAPER_STATUS_PUBLISHED
        paper = self._first_or_none(firestore_store.find_by_fields(PAPERS_COLLECTION, filters))
        if paper:
            self._set_cached_paper(
                paper,
                owner_username=owner_username_for_cache,
                project_id=paper.get(PAPER_PROJECT_KEY),
            )
        return paper

    def get_by_slug(self, owner_username: str, paper_slug: str, public: bool = False) -> dict | None:
        resolved_owner_username = self._normalize_owner_username(owner_username)
        slug = self._normalize_paper_slug(paper_slug)
        if not resolved_owner_username or not slug:
            return None

        cached = self._load_cached_paper(self._paper_by_slug_key(resolved_owner_username, slug))
        if cached:
            return cached if not public or self._is_public_paper(cached) else None

        from app.services.user_service import user_service

        try:
            owner = user_service.get_by_username(resolved_owner_username)
        except HTTPException as exc:
            if exc.status_code == 404:
                return None
            raise

        owner_id = owner.get("userId")
        if not owner_id:
            return None

        return self._get_by_owner_slug(
            owner_id=owner_id,
            paper_slug=slug,
            public=public,
            owner_username_for_cache=resolved_owner_username,
        )

    def get_by_project_slug(self, project_id: str, paper_slug: str, public: bool = False) -> dict | None:
        resolved_project_id = str(project_id or "").strip()
        slug = self._normalize_paper_slug(paper_slug)
        if not resolved_project_id or not slug:
            return None

        cached = self._load_cached_paper(self._paper_by_project_slug_key(resolved_project_id, slug))
        if cached:
            return cached if not public or self._is_public_paper(cached) else None

        filters: dict[str, object] = {PAPER_PROJECT_KEY: resolved_project_id, PAPER_SLUG_KEY: slug}
        if public:
            filters[PAPER_STATUS_KEY] = PAPER_STATUS_PUBLISHED
        paper = self._first_or_none(firestore_store.find_by_fields(PAPERS_COLLECTION, filters))
        if paper:
            self._set_cached_paper(paper, project_id=resolved_project_id)
        return paper

    def find_by_slug(
        self,
        slug: str,
        owner_username: str | None = None,
        owner_id: str | None = None,
        project_id: str | None = None,
        public: bool = False,
    ) -> dict | None:
        if project_id:
            return self.get_by_project_slug(project_id, slug, public=public)
        if owner_id:
            return self._get_by_owner_slug(
                owner_id=owner_id,
                paper_slug=slug,
                public=public,
                owner_username_for_cache=self._normalize_owner_username(owner_username),
            )
        return self.get_by_slug(owner_username or "", slug, public=public)

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
            payload["projectId"] = collection.get("projectId")
            payload["status"] = "published" if collection.get("isPublic", False) else "draft"
        elif project_id:
            project = projects_service.get_by_id(project_id)
            payload["status"] = "published" if project.get("isPublic", False) else "draft"
        else:
            payload["status"] = payload.get("status") or "draft"

        if payload.get("slug"):
            payload["slug"] = normalize_slug(payload["slug"])
            if is_reserved_paper_slug(payload["slug"]):
                raise HTTPException(status_code=409, detail="Slug is reserved.")
            existing = firestore_store.find_by_fields(
                PAPERS_COLLECTION,
                {PAPER_OWNER_KEY: owner_id, PAPER_SLUG_KEY: payload["slug"]},
            )
            if existing:
                raise HTTPException(status_code=409, detail="Paper slug already exists.")
        else:
            payload["slug"] = f"paper-{paper_id}"

        payload[PAPER_OWNER_KEY] = owner_id
        payload[PAPER_ID_KEY] = paper_id
        payload["createdAt"] = now
        payload["updatedAt"] = now
        payload["metadata"] = None
        firestore_store.create(PAPERS_COLLECTION, payload, doc_id=paper_id)

        if collection_id:
            self._refresh_collection_pages_number(collection_id)

        resolved_project_id = payload.get("projectId")
        if resolved_project_id:
            self._refresh_project_pages_number(resolved_project_id)

        return {"paperId": paper_id, "projectId": resolved_project_id}

    def update(self, paper_id: str, payload: dict, *, force_metadata_refresh: bool = False) -> dict:
        current = firestore_store.get(PAPERS_COLLECTION, paper_id)
        if not current:
            raise HTTPException(status_code=404, detail="Paper not found.")

        if payload.get("slug"):
            new_slug = normalize_slug(payload["slug"])
            if is_reserved_paper_slug(new_slug):
                raise HTTPException(status_code=409, detail="Slug is reserved.")
            existing = firestore_store.find_by_fields(
                PAPERS_COLLECTION,
                {PAPER_OWNER_KEY: current.get(PAPER_OWNER_KEY), PAPER_SLUG_KEY: new_slug},
            )
            if any(item.get(PAPER_ID_KEY) != paper_id for item in existing):
                raise HTTPException(status_code=409, detail="Paper slug already exists.")
            payload["slug"] = new_slug

        if not payload and not force_metadata_refresh:
            return current

        previous_slug = current.get(PAPER_SLUG_KEY)
        previous_project_id = current.get(PAPER_PROJECT_KEY)
        owner_username = None
        owner_id = current.get(PAPER_OWNER_KEY)
        if previous_slug and owner_id:
            from app.services.user_service import user_service

            try:
                owner_username = user_service.get_by_id(owner_id).get("username")
            except HTTPException:
                owner_username = None
        payload["updatedAt"] = utc_now()
        merged_doc = {**current, **payload}
        metadata_in_payload = "metadata" in payload

        if force_metadata_refresh:
            payload["metadata"] = self._build_metadata(merged_doc)
        elif not metadata_in_payload:
            next_status = merged_doc.get(PAPER_STATUS_KEY) or "draft"
            metadata_value = merged_doc.get("metadata")
            if next_status == PAPER_STATUS_PUBLISHED and not metadata_value:
                payload["metadata"] = self._build_metadata(merged_doc)

        firestore_store.update(PAPERS_COLLECTION, paper_id, payload)
        current.update(payload)
        self.invalidate_paper(
            paper_id=paper_id,
            owner_username=owner_username,
            slug=previous_slug,
            project_id=previous_project_id,
        )
        return current

    def generate_metadata_preview(self, paper_id: str, payload: dict) -> dict:
        current = firestore_store.get(PAPERS_COLLECTION, paper_id)
        if not current:
            raise HTTPException(status_code=404, detail="Paper not found.")

        preview_payload = dict(payload)
        if preview_payload.get("slug"):
            preview_payload["slug"] = normalize_slug(preview_payload["slug"])

        merged_doc = {**current, **preview_payload}
        return self._build_metadata(merged_doc)

    async def upload_thumbnail(self, paper_id: str, file: UploadFile) -> dict[str, str]:
        paper = self.get_by_id(paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        owner_id = paper.get(PAPER_OWNER_KEY)
        if not owner_id:
            raise HTTPException(status_code=400, detail="Paper owner is missing.")

        url = await storage_service.upload_image(
            f"users/{owner_id}/papers/{paper_id}/thumbnail",
            file,
            max_width=MAX_THUMBNAIL_WIDTH,
            max_height=MAX_THUMBNAIL_HEIGHT,
            crop=False,
            overwrite_name="thumbnail",
        )
        url = add_cache_buster(url)
        self.update(paper_id, {"thumbnailUrl": url})
        return {"url": url}

    async def upload_metadata_image(self, paper_id: str, field: str, file: UploadFile) -> dict[str, str]:
        paper = self.get_by_id(paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        owner_id = paper.get(PAPER_OWNER_KEY)
        if not owner_id:
            raise HTTPException(status_code=400, detail="Paper owner is missing.")

        if field not in METADATA_IMAGE_FIELDS:
            raise HTTPException(status_code=400, detail="Unsupported metadata image field.")

        url = await storage_service.upload_image(
            f"users/{owner_id}/papers/{paper_id}/metadata",
            file,
            max_width=500,
            max_height=500,
            crop=False,
            overwrite_name=field,
        )
        return {"url": add_cache_buster(url)}

    async def upload_embedded_image(self, paper_id: str, file: UploadFile) -> dict[str, str]:
        paper = self.get_by_id(paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        owner_id = paper.get(PAPER_OWNER_KEY)
        if not owner_id:
            raise HTTPException(status_code=400, detail="Paper owner is missing.")

        url = await storage_service.upload_image(
            f"users/{owner_id}/papers/{paper_id}/embedded",
            file,
            max_width=MAX_EMBEDDED_WIDTH,
            max_height=MAX_EMBEDDED_HEIGHT,
            crop=False,
        )
        return {"url": url}

    def delete_unused_embedded_images(self, owner_id: str, paper_id: str, used_urls: set[str]) -> int:
        return storage_service.delete_unreferenced_blobs(
            f"users/{owner_id}/papers/{paper_id}/embedded/",
            used_urls,
        )

    def delete_thumbnail(self, owner_id: str, paper_id: str) -> bool:
        base = f"users/{owner_id}/papers/{paper_id}/thumbnail/thumbnail"
        return storage_service.delete_first_existing(
            [base, *[f"{base}{ext}" for ext in SUPPORTED_IMAGE_EXTENSIONS]]
        )

    @staticmethod
    def extract_metadata_image_urls(metadata: dict | None) -> set[str]:
        if not isinstance(metadata, dict):
            return set()
        used_urls: set[str] = set()
        for field in METADATA_IMAGE_FIELDS:
            value = metadata.get(field)
            if isinstance(value, str) and value.strip():
                used_urls.add(value.strip())
        return used_urls

    def delete_unused_metadata_images(self, owner_id: str, paper_id: str, used_urls: set[str]) -> int:
        return storage_service.delete_unreferenced_blobs(
            f"users/{owner_id}/papers/{paper_id}/metadata/",
            used_urls,
        )

    def delete_paper_assets(self, owner_id: str, paper_id: str) -> int:
        return storage_service.delete_by_prefix(f"users/{owner_id}/papers/{paper_id}/")

    def delete(self, paper_id: str) -> dict[str, bool]:
        current = firestore_store.get(PAPERS_COLLECTION, paper_id)
        if not current:
            raise HTTPException(status_code=404, detail="Paper not found.")

        collection_id = current.get("collectionId")
        project_id = current.get("projectId")
        owner_id = current.get(PAPER_OWNER_KEY)
        if owner_id:
            self.delete_paper_assets(owner_id, paper_id)
        firestore_store.delete(PAPERS_COLLECTION, paper_id)
        owner_username = None
        if owner_id:
            from app.services.user_service import user_service

            try:
                owner_username = user_service.get_by_id(owner_id).get("username")
            except HTTPException:
                owner_username = None
        self.invalidate_paper(
            paper_id=paper_id,
            owner_username=owner_username,
            slug=current.get(PAPER_SLUG_KEY),
            project_id=current.get(PAPER_PROJECT_KEY),
        )

        if collection_id:
            self._refresh_collection_pages_number(collection_id)
        if project_id:
            self._refresh_project_pages_number(project_id)
        return {"ok": True}

    def is_slug_available(self, owner_id: str, slug: str, paper_id: str | None = None) -> bool:
        normalized = normalize_slug(slug)
        if not normalized or is_reserved_paper_slug(normalized):
            return False
        matches = firestore_store.find_by_fields(
            PAPERS_COLLECTION,
            {PAPER_OWNER_KEY: owner_id, PAPER_SLUG_KEY: normalized},
        )
        return all(item.get(PAPER_ID_KEY) == paper_id for item in matches)


papers_service = PapersService()
