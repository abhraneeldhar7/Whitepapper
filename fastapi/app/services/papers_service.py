import re
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.constants import (
    MAX_EMBEDDED_HEIGHT,
    MAX_EMBEDDED_WIDTH,
    MAX_THUMBNAIL_HEIGHT,
    MAX_THUMBNAIL_WIDTH,
)
from app.core.limits import MAX_IMAGES_PER_PAPER, MAX_PAPER_BODY_LENGTH, MAX_PAPERS_PER_USER
from app.core.firestore_store import firestore_store
from app.core.reserved_paths import is_reserved_paper_slug
from app.services.paper_metadata_service import paper_metadata_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service
from app.utils.cache import add_cache_buster
from app.utils.datetime import utc_now
from app.utils.pagination import apply_order_by, paginate_items

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
MARKDOWN_IMAGE_PATTERN = re.compile(r"!\[[^\]]*]\(([^)\s]+)", re.IGNORECASE)
HTML_IMAGE_PATTERN = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)
class PapersService:

    @staticmethod
    def _count_images_in_body(content: str | None) -> int:
        body = content or ""
        markdown_hits = MARKDOWN_IMAGE_PATTERN.findall(body)
        html_hits = HTML_IMAGE_PATTERN.findall(body)
        return len(markdown_hits) + len(html_hits)

    @staticmethod
    def _validate_body_limits(body: str | None) -> None:
        value = body or ""
        if len(value) > MAX_PAPER_BODY_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Paper content is too long. "
                    f"Maximum length is {MAX_PAPER_BODY_LENGTH} characters."
                ),
            )
        image_count = PapersService._count_images_in_body(value)
        if image_count > MAX_IMAGES_PER_PAPER:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Paper image limit reached ({MAX_IMAGES_PER_PAPER}). "
                    "Remove some images before saving."
                ),
            )

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

    def invalidate_paper(
        self,
        paper_id: str,
        owner_username: str | None = None,
        slug: str | None = None,
        project_id: str | None = None,
    ) -> None:
        return None

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
        items = firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_OWNER_KEY: owner_id})
        if public:
            return [item for item in items if item.get(PAPER_STATUS_KEY) == PAPER_STATUS_PUBLISHED]
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

    def list_standalone(self, owner_id: str, public: bool = False) -> list[dict]:
        return self.list_owned_filtered(owner_id=owner_id, standalone=True, public=public)

    def list_standalone_paginated(
        self,
        owner_id: str,
        *,
        public: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        return self.list_owned_filtered_paginated(
            owner_id=owner_id,
            standalone=True,
            public=public,
            limit=limit,
            cursor=cursor,
            order_by=order_by,
        )

    def list_owned_filtered(
        self,
        owner_id: str,
        project_id: str | None = None,
        standalone: bool = False,
        public: bool = False,
        status: str | None = None,
    ) -> list[dict]:
        items = self.list_owned(owner_id, public=public)
        normalized_status = str(status).strip().lower() if status else None

        def _matches(item: dict) -> bool:
            item_project_id = item.get(PAPER_PROJECT_KEY)
            item_collection_id = item.get(PAPER_COLLECTION_KEY)
            item_status = str(item.get(PAPER_STATUS_KEY) or "").strip().lower()

            if project_id:
                if item_project_id != project_id:
                    return False
                if standalone and item_collection_id is not None:
                    return False
            elif standalone and item_project_id is not None:
                return False

            if not public and normalized_status and item_status != normalized_status:
                return False
            return True

        return [item for item in items if _matches(item)]

    def list_owned_filtered_paginated(
        self,
        owner_id: str,
        *,
        project_id: str | None = None,
        standalone: bool = False,
        public: bool = False,
        status: str | None = None,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_owned_filtered(
            owner_id=owner_id,
            project_id=project_id,
            standalone=standalone,
            public=public,
            status=status,
        )
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_by_project_id(self, project_id: str, public: bool = False, standalone: bool = False) -> list[dict]:
        items = firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_PROJECT_KEY: project_id})

        def _matches(item: dict) -> bool:
            if standalone and item.get(PAPER_COLLECTION_KEY) is not None:
                return False
            if public and item.get(PAPER_STATUS_KEY) != PAPER_STATUS_PUBLISHED:
                return False
            return True

        return [item for item in items if _matches(item)]

    def list_by_project_id_paginated(
        self,
        project_id: str,
        *,
        public: bool = False,
        standalone: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_by_project_id(project_id, public=public, standalone=standalone)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_by_collection_id(self, collection_id: str, public: bool = False, status: str | None = None) -> list[dict]:
        items = firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_COLLECTION_KEY: collection_id})
        normalized_status = str(status).strip().lower() if status else None

        def _matches(item: dict) -> bool:
            item_status = str(item.get(PAPER_STATUS_KEY) or "").strip().lower()
            if public:
                return item_status == PAPER_STATUS_PUBLISHED
            if normalized_status:
                return item_status == normalized_status
            return True

        return [item for item in items if _matches(item)]

    def list_by_collection_id_paginated(
        self,
        collection_id: str,
        *,
        public: bool = False,
        status: str | None = None,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_by_collection_id(collection_id, public=public, status=status)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_all_public(self) -> list[dict]:
        return firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_STATUS_KEY: PAPER_STATUS_PUBLISHED})

    def get_many_by_ids(self, paper_ids: list[str]) -> list[dict]:
        return firestore_store.get_many(PAPERS_COLLECTION, paper_ids)

    def search_owned(
        self,
        owner_id: str,
        query: str,
        *,
        project_id: str | None = None,
        collection_id: str | None = None,
        status: str | None = None,
        limit: int = 25,
    ) -> list[dict]:
        search_query = str(query or "").strip().lower()
        if not search_query:
            raise HTTPException(status_code=400, detail="query is required.")

        papers = self.list_owned(owner_id)
        if status:
            normalized_status = str(status).strip().lower()
            if normalized_status not in {"draft", "published", "archived"}:
                raise HTTPException(status_code=400, detail="status must be draft, published, or archived.")
            papers = [
                item for item in papers if str(item.get(PAPER_STATUS_KEY) or "").strip().lower() == normalized_status
            ]
        if project_id:
            papers = [item for item in papers if item.get(PAPER_PROJECT_KEY) == project_id]
        if collection_id:
            papers = [item for item in papers if item.get(PAPER_COLLECTION_KEY) == collection_id]
        ranked: dict[str, tuple[int, dict]] = {}

        for paper in papers:
            haystacks = [
                str(paper.get("title") or ""),
                str(paper.get("slug") or ""),
                str(paper.get("body") or ""),
                str((paper.get("metadata") or {}).get("title") or ""),
                str((paper.get("metadata") or {}).get("metaDescription") or ""),
            ]

            score = 0
            for text in haystacks:
                lowered = text.lower()
                if not lowered:
                    continue
                if search_query in lowered:
                    score += 3
                score += lowered.count(search_query)

            if score <= 0:
                continue

            paper_id = str(paper.get(PAPER_ID_KEY) or "")
            existing = ranked.get(paper_id)
            if existing is None or score > existing[0]:
                ranked[paper_id] = (score, paper)

        ordered = sorted(
            ranked.values(),
            key=lambda item: (
                item[0],
                str(item[1].get("updatedAt") or item[1].get("createdAt") or ""),
            ),
            reverse=True,
        )
        return [item[1] for item in ordered[: max(1, int(limit or 25))]]

    def get_by_id(self, paper_id: str, public: bool = False) -> dict | None:
        paper = firestore_store.get(PAPERS_COLLECTION, paper_id)
        if paper:
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

        matches = [
            item
            for item in self.list_owned(owner_id, public=public)
            if str(item.get(PAPER_SLUG_KEY) or "").strip() == slug
        ]
        return self._first_or_none(matches)

    def get_by_slug(self, owner_username: str, paper_slug: str, public: bool = False) -> dict | None:
        resolved_owner_username = self._normalize_owner_username(owner_username)
        slug = self._normalize_paper_slug(paper_slug)
        if not resolved_owner_username or not slug:
            return None

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

        matches = [
            item
            for item in self.list_by_project_id(resolved_project_id, public=public)
            if str(item.get(PAPER_SLUG_KEY) or "").strip() == slug
        ]
        return self._first_or_none(matches)

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
        owned_papers = self.list_owned(owner_id)
        if len(owned_papers) >= MAX_PAPERS_PER_USER:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Paper limit reached ({MAX_PAPERS_PER_USER}) for this user. "
                    "Delete an existing paper to create a new one."
                ),
            )

        paper_id = str(uuid4())
        now = utc_now()
        payload["title"] = (payload.get("title") or "Untitled Paper").strip() or "Untitled Paper"
        self._validate_body_limits(payload.get("body"))

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
            existing = [
                item
                for item in self.list_owned(owner_id)
                if str(item.get(PAPER_SLUG_KEY) or "").strip() == str(payload["slug"]).strip()
            ]
            if existing:
                raise HTTPException(status_code=409, detail="Paper slug already exists.")
        else:
            payload["slug"] = f"init-paper-{paper_id[:8]}"

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

        if "body" in payload:
            self._validate_body_limits(payload.get("body"))

        if payload.get("slug"):
            new_slug = normalize_slug(payload["slug"])
            if is_reserved_paper_slug(new_slug):
                raise HTTPException(status_code=409, detail="Slug is reserved.")
            existing = [
                item
                for item in self.list_owned(str(current.get(PAPER_OWNER_KEY) or ""))
                if str(item.get(PAPER_SLUG_KEY) or "").strip() == new_slug
            ]
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

        if force_metadata_refresh:
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

    def generate_metadata_preview(self, paper_doc: dict) -> dict:
        preview_payload = dict(paper_doc)
        if preview_payload.get("slug"):
            preview_payload["slug"] = normalize_slug(preview_payload["slug"])
        return self._build_metadata(preview_payload)

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

    def get_random_default_thumbnail_url(self) -> str:
        url = storage_service.get_random_public_url_by_prefix("defaultThumbnails/")
        if not url:
            raise HTTPException(status_code=404, detail="No default thumbnails found in storage.")
        return add_cache_buster(url)

    def apply_random_default_thumbnail(self, paper_id: str) -> dict[str, str]:
        paper = self.get_by_id(paper_id)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")

        url = self.get_random_default_thumbnail_url()
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

        embedded_prefix = f"users/{owner_id}/papers/{paper_id}/embedded/"
        current_images = storage_service.count_by_prefix(embedded_prefix, max_count=MAX_IMAGES_PER_PAPER)
        if current_images >= MAX_IMAGES_PER_PAPER:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Paper image limit reached ({MAX_IMAGES_PER_PAPER}). "
                    "Remove some images before uploading a new one."
                ),
            )

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

    def delete_cascade(self, paper_id: str) -> dict[str, int]:
        current = firestore_store.get(PAPERS_COLLECTION, paper_id)
        if not current:
            raise HTTPException(status_code=404, detail="Paper not found.")

        collection_id = current.get("collectionId")
        project_id = current.get("projectId")
        owner_id = current.get(PAPER_OWNER_KEY)
        deleted_storage_objects = 0
        if owner_id:
            deleted_storage_objects = self.delete_paper_assets(owner_id, paper_id)
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
        return {
            "papers": 1,
            "storageObjects": deleted_storage_objects,
        }

    def delete(self, paper_id: str) -> dict[str, bool]:
        self.delete_cascade(paper_id)
        return {"ok": True}

    def is_slug_available(self, owner_id: str, slug: str, paper_id: str | None = None) -> bool:
        normalized = normalize_slug(slug)
        if not normalized or is_reserved_paper_slug(normalized):
            return False
        matches = [
            item
            for item in self.list_owned(owner_id)
            if str(item.get(PAPER_SLUG_KEY) or "").strip() == normalized
        ]
        return all(item.get(PAPER_ID_KEY) == paper_id for item in matches)


papers_service = PapersService()
