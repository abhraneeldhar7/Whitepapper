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
from app.core.reserved_paths import is_reserved_paperSlug
from app.services.paper_metadata_service import paper_metadata_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service
from app.utils.cache import add_cache_buster
from app.utils.content import HTML_IMAGE_PATTERN, MARKDOWN_IMAGE_PATTERN
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
    def _normalize_ownerUsername(ownerUsername: str | None) -> str:
        resolved = (ownerUsername or "").strip().lower()
        if "@" in resolved:
            return ""
        return resolved

    @staticmethod
    def _normalize_paperSlug(paperSlug: str | None) -> str:
        return normalize_slug(paperSlug or "")

    @staticmethod
    def _is_public_paper(paper: dict | None) -> bool:
        return bool(paper) and paper.get(PAPER_STATUS_KEY) == PAPER_STATUS_PUBLISHED

    @staticmethod
    def _first_or_none(items: list[dict]) -> dict | None:
        return items[0] if items else None

    @staticmethod
    def _resolve_author_doc(ownerId: str | None) -> dict | None:
        if not ownerId:
            return None
        from app.services.user_service import user_service

        try:
            return user_service.get_by_id(ownerId)
        except HTTPException:
            return None

    @staticmethod
    def _resolve_project_doc(projectId: str | None) -> dict | None:
        if not projectId:
            return None
        try:
            return projects_service.get_by_id(projectId)
        except HTTPException:
            return None

    def _build_metadata(self, paper_doc: dict) -> dict:
        return paper_metadata_service.build_metadata(
            paper_doc=paper_doc,
            author_doc=self._resolve_author_doc(paper_doc.get(PAPER_OWNER_KEY)),
            project_doc=self._resolve_project_doc(paper_doc.get(PAPER_PROJECT_KEY)),
        )

    def _refresh_collection_pages_number(self, collectionId: str) -> None:
        papers = self.list_by_collectionId(collectionId)
        now = utc_now()
        firestore_store.update(
            "collections",
            collectionId,
            {"pagesNumber": len(papers), "updatedAt": now},
        )

    def _refresh_project_pages_number(self, projectId: str) -> None:
        papers = self.list_by_projectId(projectId)
        try:
            projects_service.update(projectId, {"pagesNumber": len(papers)})
        except HTTPException as exc:
            if exc.status_code != 404:
                raise

    def list_owned(self, ownerId: str, public: bool = False) -> list[dict]:
        items = firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_OWNER_KEY: ownerId})
        if public:
            return [item for item in items if item.get(PAPER_STATUS_KEY) == PAPER_STATUS_PUBLISHED]
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

    def list_standalone(self, ownerId: str, public: bool = False) -> list[dict]:
        return self.list_owned_filtered(ownerId=ownerId, standalone=True, public=public)

    def list_standalone_paginated(
        self,
        ownerId: str,
        *,
        public: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        return self.list_owned_filtered_paginated(
            ownerId=ownerId,
            standalone=True,
            public=public,
            limit=limit,
            cursor=cursor,
            order_by=order_by,
        )

    def list_owned_filtered(
        self,
        ownerId: str,
        projectId: str | None = None,
        standalone: bool = False,
        public: bool = False,
        status: str | None = None,
    ) -> list[dict]:
        items = self.list_owned(ownerId, public=public)
        normalized_status = str(status).strip().lower() if status else None

        def _matches(item: dict) -> bool:
            item_projectId = item.get(PAPER_PROJECT_KEY)
            item_collectionId = item.get(PAPER_COLLECTION_KEY)
            item_status = str(item.get(PAPER_STATUS_KEY) or "").strip().lower()

            if projectId:
                if item_projectId != projectId:
                    return False
                if standalone and item_collectionId is not None:
                    return False
            elif standalone and item_projectId is not None:
                return False

            if not public and normalized_status and item_status != normalized_status:
                return False
            return True

        return [item for item in items if _matches(item)]

    def list_owned_filtered_paginated(
        self,
        ownerId: str,
        *,
        projectId: str | None = None,
        standalone: bool = False,
        public: bool = False,
        status: str | None = None,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_owned_filtered(
            ownerId=ownerId,
            projectId=projectId,
            standalone=standalone,
            public=public,
            status=status,
        )
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_by_projectId(self, projectId: str, public: bool = False, standalone: bool = False) -> list[dict]:
        items = firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_PROJECT_KEY: projectId})

        def _matches(item: dict) -> bool:
            if standalone and item.get(PAPER_COLLECTION_KEY) is not None:
                return False
            if public and item.get(PAPER_STATUS_KEY) != PAPER_STATUS_PUBLISHED:
                return False
            return True

        return [item for item in items if _matches(item)]

    def list_by_projectId_paginated(
        self,
        projectId: str,
        *,
        public: bool = False,
        standalone: bool = False,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_by_projectId(projectId, public=public, standalone=standalone)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_by_collectionId(self, collectionId: str, public: bool = False, status: str | None = None) -> list[dict]:
        items = firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_COLLECTION_KEY: collectionId})
        normalized_status = str(status).strip().lower() if status else None

        def _matches(item: dict) -> bool:
            item_status = str(item.get(PAPER_STATUS_KEY) or "").strip().lower()
            if public:
                return item_status == PAPER_STATUS_PUBLISHED
            if normalized_status:
                return item_status == normalized_status
            return True

        return [item for item in items if _matches(item)]

    def list_by_collectionId_paginated(
        self,
        collectionId: str,
        *,
        public: bool = False,
        status: str | None = None,
        limit: int = 25,
        cursor: str | None = None,
        order_by: list[tuple[str, str]] | None = None,
    ) -> dict:
        items = self.list_by_collectionId(collectionId, public=public, status=status)
        items = apply_order_by(items, order_by=order_by)
        return paginate_items(items, limit=limit, cursor=cursor)

    def list_all_public(self) -> list[dict]:
        return firestore_store.find_by_fields(PAPERS_COLLECTION, {PAPER_STATUS_KEY: PAPER_STATUS_PUBLISHED})

    def get_many_by_ids(self, paperIds: list[str]) -> list[dict]:
        return firestore_store.get_many(PAPERS_COLLECTION, paperIds)

    def search_owned(
        self,
        ownerId: str,
        query: str,
        *,
        projectId: str | None = None,
        collectionId: str | None = None,
        status: str | None = None,
        limit: int = 25,
    ) -> list[dict]:
        search_query = str(query or "").strip().lower()
        if not search_query:
            raise HTTPException(status_code=400, detail="query is required.")

        papers = self.list_owned(ownerId)
        if status:
            normalized_status = str(status).strip().lower()
            if normalized_status not in {"draft", "published", "archived"}:
                raise HTTPException(status_code=400, detail="status must be draft, published, or archived.")
            papers = [
                item for item in papers if str(item.get(PAPER_STATUS_KEY) or "").strip().lower() == normalized_status
            ]
        if projectId:
            papers = [item for item in papers if item.get(PAPER_PROJECT_KEY) == projectId]
        if collectionId:
            papers = [item for item in papers if item.get(PAPER_COLLECTION_KEY) == collectionId]
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

            paperId = str(paper.get(PAPER_ID_KEY) or "")
            existing = ranked.get(paperId)
            if existing is None or score > existing[0]:
                ranked[paperId] = (score, paper)

        ordered = sorted(
            ranked.values(),
            key=lambda item: (
                item[0],
                str(item[1].get("updatedAt") or item[1].get("createdAt") or ""),
            ),
            reverse=True,
        )
        return [item[1] for item in ordered[: max(1, int(limit or 25))]]

    def get_by_id(self, paperId: str, public: bool = False) -> dict | None:
        paper = firestore_store.get(PAPERS_COLLECTION, paperId)
        if paper:
            if public and not self._is_public_paper(paper):
                return None
        return paper

    def _get_by_owner_slug(
        self,
        ownerId: str,
        paperSlug: str,
        *,
        public: bool = False,
        ownerUsername_for_cache: str | None = None,
    ) -> dict | None:
        slug = self._normalize_paperSlug(paperSlug)
        if not ownerId or not slug:
            return None

        matches = [
            item
            for item in self.list_owned(ownerId, public=public)
            if str(item.get(PAPER_SLUG_KEY) or "").strip() == slug
        ]
        return self._first_or_none(matches)

    def get_by_slug(self, ownerUsername: str, paperSlug: str, public: bool = False) -> dict | None:
        resolved_ownerUsername = self._normalize_ownerUsername(ownerUsername)
        slug = self._normalize_paperSlug(paperSlug)
        if not resolved_ownerUsername or not slug:
            return None

        from app.services.user_service import user_service

        try:
            owner = user_service.get_by_username(resolved_ownerUsername)
        except HTTPException as exc:
            if exc.status_code == 404:
                return None
            raise

        ownerId = owner.get("userId")
        if not ownerId:
            return None

        return self._get_by_owner_slug(
            ownerId=ownerId,
            paperSlug=slug,
            public=public,
            ownerUsername_for_cache=resolved_ownerUsername,
        )

    def get_by_project_slug(self, projectId: str, paperSlug: str, public: bool = False) -> dict | None:
        resolved_projectId = str(projectId or "").strip()
        slug = self._normalize_paperSlug(paperSlug)
        if not resolved_projectId or not slug:
            return None

        matches = [
            item
            for item in self.list_by_projectId(resolved_projectId, public=public)
            if str(item.get(PAPER_SLUG_KEY) or "").strip() == slug
        ]
        return self._first_or_none(matches)

    def find_by_slug(
        self,
        slug: str,
        ownerUsername: str | None = None,
        ownerId: str | None = None,
        projectId: str | None = None,
        public: bool = False,
    ) -> dict | None:
        if projectId:
            return self.get_by_project_slug(projectId, slug, public=public)
        if ownerId:
            return self._get_by_owner_slug(
                ownerId=ownerId,
                paperSlug=slug,
                public=public,
                ownerUsername_for_cache=self._normalize_ownerUsername(ownerUsername),
            )
        return self.get_by_slug(ownerUsername or "", slug, public=public)

    def create(self, ownerId: str, payload: dict) -> dict:
        owned_papers = self.list_owned(ownerId)
        if len(owned_papers) >= MAX_PAPERS_PER_USER:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Paper limit reached ({MAX_PAPERS_PER_USER}) for this user. "
                    "Delete an existing paper to create a new one."
                ),
            )

        paperId = str(uuid4())
        now = utc_now()
        payload["title"] = (payload.get("title") or "Untitled Paper").strip() or "Untitled Paper"
        self._validate_body_limits(payload.get("body"))

        collectionId = payload.get("collectionId")
        projectId = payload.get("projectId")
        if collectionId:
            collection = firestore_store.get("collections", collectionId)
            if not collection:
                raise HTTPException(status_code=404, detail="Collection not found.")
            payload["projectId"] = collection.get("projectId")
            payload["status"] = "published" if collection.get("isPublic", False) else "draft"
        elif projectId:
            project = projects_service.get_by_id(projectId)
            payload["status"] = "published" if project.get("isPublic", False) else "draft"
        else:
            payload["status"] = payload.get("status") or "draft"

        if payload.get("slug"):
            payload["slug"] = normalize_slug(payload["slug"])
            if is_reserved_paperSlug(payload["slug"]):
                raise HTTPException(status_code=409, detail="Slug is reserved.")
            existing = [
                item
                for item in self.list_owned(ownerId)
                if str(item.get(PAPER_SLUG_KEY) or "").strip() == str(payload["slug"]).strip()
            ]
            if existing:
                raise HTTPException(status_code=409, detail="Paper slug already exists.")
        else:
            payload["slug"] = f"init-paper-{paperId[:8]}"

        payload[PAPER_OWNER_KEY] = ownerId
        payload[PAPER_ID_KEY] = paperId
        payload["createdAt"] = now
        payload["updatedAt"] = now
        payload["metadata"] = None
        firestore_store.create(PAPERS_COLLECTION, payload, doc_id=paperId)

        if collectionId:
            self._refresh_collection_pages_number(collectionId)

        resolved_projectId = payload.get("projectId")
        if resolved_projectId:
            self._refresh_project_pages_number(resolved_projectId)

        return {"paperId": paperId, "projectId": resolved_projectId}

    def update(self, paperId: str, payload: dict) -> dict:
        current = firestore_store.get(PAPERS_COLLECTION, paperId)
        if not current:
            raise HTTPException(status_code=404, detail="Paper not found.")

        if "body" in payload:
            self._validate_body_limits(payload.get("body"))

        if payload.get("slug"):
            new_slug = normalize_slug(payload["slug"])
            if is_reserved_paperSlug(new_slug):
                raise HTTPException(status_code=409, detail="Slug is reserved.")
            existing = [
                item
                for item in self.list_owned(str(current.get(PAPER_OWNER_KEY) or ""))
                if str(item.get(PAPER_SLUG_KEY) or "").strip() == new_slug
            ]
            if any(item.get(PAPER_ID_KEY) != paperId for item in existing):
                raise HTTPException(status_code=409, detail="Paper slug already exists.")
            payload["slug"] = new_slug

        if not payload:
            return current

        payload["updatedAt"] = utc_now()

        firestore_store.update(PAPERS_COLLECTION, paperId, payload)
        current.update(payload)
        return current

    def preview_metadata(self, paper_doc: dict) -> dict:
        preview_payload = dict(paper_doc)
        if preview_payload.get("slug"):
            preview_payload["slug"] = normalize_slug(preview_payload["slug"])
        return self._build_metadata(preview_payload)

    async def upload_thumbnail(self, paperId: str, file: UploadFile) -> dict[str, str]:
        paper = self.get_by_id(paperId)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        ownerId = paper.get(PAPER_OWNER_KEY)
        if not ownerId:
            raise HTTPException(status_code=400, detail="Paper owner is missing.")

        url = await storage_service.upload_image(
            f"users/{ownerId}/papers/{paperId}/thumbnail",
            file,
            max_width=MAX_THUMBNAIL_WIDTH,
            max_height=MAX_THUMBNAIL_HEIGHT,
            crop=False,
            overwrite_name="thumbnail",
        )
        url = add_cache_buster(url)
        self.update(paperId, {"thumbnailUrl": url})
        return {"url": url}

    def get_random_default_thumbnail_url(self) -> str:
        url = storage_service.get_random_public_url_by_prefix("defaultThumbnails/")
        if not url:
            raise HTTPException(status_code=404, detail="No default thumbnails found in storage.")
        return add_cache_buster(url)

    def apply_random_default_thumbnail(self, paperId: str) -> dict[str, str]:
        paper = self.get_by_id(paperId)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")

        url = self.get_random_default_thumbnail_url()
        self.update(paperId, {"thumbnailUrl": url})
        return {"url": url}

    async def upload_metadata_image(self, paperId: str, field: str, file: UploadFile) -> dict[str, str]:
        paper = self.get_by_id(paperId)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        ownerId = paper.get(PAPER_OWNER_KEY)
        if not ownerId:
            raise HTTPException(status_code=400, detail="Paper owner is missing.")

        if field not in METADATA_IMAGE_FIELDS:
            raise HTTPException(status_code=400, detail="Unsupported metadata image field.")

        url = await storage_service.upload_image(
            f"users/{ownerId}/papers/{paperId}/metadata",
            file,
            max_width=500,
            max_height=500,
            crop=False,
            overwrite_name=field,
        )
        return {"url": add_cache_buster(url)}

    async def upload_embedded_image(self, paperId: str, file: UploadFile) -> dict[str, str]:
        paper = self.get_by_id(paperId)
        if not paper:
            raise HTTPException(status_code=404, detail="Paper not found.")
        ownerId = paper.get(PAPER_OWNER_KEY)
        if not ownerId:
            raise HTTPException(status_code=400, detail="Paper owner is missing.")

        embedded_prefix = f"users/{ownerId}/papers/{paperId}/embedded/"
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
            f"users/{ownerId}/papers/{paperId}/embedded",
            file,
            max_width=MAX_EMBEDDED_WIDTH,
            max_height=MAX_EMBEDDED_HEIGHT,
            crop=False,
        )
        return {"url": url}

    def delete_unused_embedded_images(self, ownerId: str, paperId: str, used_urls: set[str]) -> int:
        return storage_service.delete_unreferenced_blobs(
            f"users/{ownerId}/papers/{paperId}/embedded/",
            used_urls,
        )

    def delete_thumbnail(self, ownerId: str, paperId: str) -> bool:
        base = f"users/{ownerId}/papers/{paperId}/thumbnail/thumbnail"
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

    def delete_unused_metadata_images(self, ownerId: str, paperId: str, used_urls: set[str]) -> int:
        return storage_service.delete_unreferenced_blobs(
            f"users/{ownerId}/papers/{paperId}/metadata/",
            used_urls,
        )

    def delete_paper_assets(self, ownerId: str, paperId: str) -> int:
        return storage_service.delete_by_prefix(f"users/{ownerId}/papers/{paperId}/")

    def delete_cascade(self, paperId: str) -> dict[str, int]:
        current = firestore_store.get(PAPERS_COLLECTION, paperId)
        if not current:
            raise HTTPException(status_code=404, detail="Paper not found.")

        collectionId = current.get("collectionId")
        projectId = current.get("projectId")
        ownerId = current.get(PAPER_OWNER_KEY)
        deleted_storage_objects = 0
        if ownerId:
            deleted_storage_objects = self.delete_paper_assets(ownerId, paperId)
        firestore_store.delete(PAPERS_COLLECTION, paperId)

        if collectionId:
            self._refresh_collection_pages_number(collectionId)
        if projectId:
            self._refresh_project_pages_number(projectId)
        return {
            "papers": 1,
            "storageObjects": deleted_storage_objects,
        }

    def delete(self, paperId: str) -> dict[str, bool]:
        self.delete_cascade(paperId)
        return {"ok": True}

    def is_slug_available(self, ownerId: str, slug: str, paperId: str | None = None) -> bool:
        normalized = normalize_slug(slug)
        if not normalized or is_reserved_paperSlug(normalized):
            return False
        matches = [
            item
            for item in self.list_owned(ownerId)
            if str(item.get(PAPER_SLUG_KEY) or "").strip() == normalized
        ]
        return all(item.get(PAPER_ID_KEY) == paperId for item in matches)


papers_service = PapersService()
