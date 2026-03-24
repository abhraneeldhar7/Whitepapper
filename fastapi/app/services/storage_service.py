from __future__ import annotations

from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings
from app.core.firebase_admin import get_storage_bucket
from app.utils.images import compress_image

ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024


class StorageService:
    def __init__(self) -> None:
        self.bucket = None
        self.settings = get_settings()

    def _bucket(self):
        if self.bucket is None:
            self.bucket = get_storage_bucket()
        return self.bucket

    async def upload_image(
        self,
        path_prefix: str,
        file: UploadFile,
        max_width: int | None = None,
        max_height: int | None = None,
        crop: bool = False,
        overwrite_name: str | None = None,
    ) -> str:
        if file.content_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported image format.")

        content = await file.read()
        if len(content) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="Image file too large (max 8MB).")

        content_type = file.content_type or "image/jpeg"
        ext = Path(file.filename or "image").suffix.lower() or ".jpg"
        if max_width and max_height:
            content, content_type, ext = compress_image(content, max_width, max_height, crop=crop)

        filename = overwrite_name or f"{uuid4()}{ext}"
        object_path = f"{path_prefix}/{filename}"
        blob = self._bucket().blob(object_path)
        blob.upload_from_string(content, content_type=content_type)
        blob.make_public()
        return blob.public_url

    def delete_owner_assets(self, owner_id: str) -> int:
        deleted = 0
        prefix = f"{owner_id}/"
        for blob in self._bucket().list_blobs(prefix=prefix):
            blob.delete()
            deleted += 1
        return deleted

    def delete_unused_embedded_images(self, paper_id: str, used_urls: set[str]) -> int:
        def normalize(url: str) -> str:
            parts = urlsplit(url)
            return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))

        normalized_used = {normalize(url) for url in used_urls}
        deleted = 0
        prefix = f"papers/{paper_id}/embedded/"
        for blob in self._bucket().list_blobs(prefix=prefix):
            blob_url = normalize(blob.public_url)
            if blob_url not in normalized_used:
                blob.delete()
                deleted += 1
        return deleted

    def delete_paper_assets(self, paper_id: str) -> int:
        deleted = 0
        prefix = f"papers/{paper_id}/"
        for blob in self._bucket().list_blobs(prefix=prefix):
            blob.delete()
            deleted += 1
        return deleted

    def delete_thumbnail(self, paper_id: str) -> bool:
        for object_path in (
            f"papers/{paper_id}/thumbnail/thumbnail",
            f"papers/{paper_id}/thumbnail/thumbnail.jpg",
        ):
            blob = self._bucket().blob(object_path)
            if blob.exists():
                blob.delete()
                return True
        return False

    def delete_unused_project_embedded_images(self, project_id: str, used_urls: set[str]) -> int:
        def normalize(url: str) -> str:
            parts = urlsplit(url)
            return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))

        normalized_used = {normalize(url) for url in used_urls}
        deleted = 0
        prefix = f"projects/{project_id}/embedded/"
        for blob in self._bucket().list_blobs(prefix=prefix):
            blob_url = normalize(blob.public_url)
            if blob_url not in normalized_used:
                blob.delete()
                deleted += 1
        return deleted

    def delete_project_assets(self, project_id: str) -> int:
        deleted = 0
        prefix = f"projects/{project_id}/"
        for blob in self._bucket().list_blobs(prefix=prefix):
            blob.delete()
            deleted += 1
        return deleted

    def delete_project_logo(self, project_id: str) -> bool:
        for object_path in (
            f"projects/{project_id}/logo/logo",
            f"projects/{project_id}/logo/logo.jpg",
        ):
            blob = self._bucket().blob(object_path)
            if blob.exists():
                blob.delete()
                return True
        return False


storage_service = StorageService()
