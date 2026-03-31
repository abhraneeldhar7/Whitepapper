from __future__ import annotations

import io
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import get_settings
from app.core.firebase_admin import get_storage_bucket
from app.utils.images import compress_image

ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
IMAGE_FORMAT_TO_MIME_EXT = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
    "GIF": ("image/gif", ".gif"),
}
IMAGE_MIME_TO_EXTENSIONS = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
    "image/gif": {".gif"},
}
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024


class StorageService:
    def __init__(self) -> None:
        self.bucket = None
        self.settings = get_settings()

    def _bucket(self):
        if self.bucket is None:
            self.bucket = get_storage_bucket()
        return self.bucket

    @staticmethod
    def _resolve_image_metadata(file: UploadFile, content: bytes) -> tuple[str, str, str]:
        claimed_type = (file.content_type or "").lower().strip()
        if claimed_type and claimed_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported image format.")

        try:
            with Image.open(io.BytesIO(content)) as image:
                image.verify()
            with Image.open(io.BytesIO(content)) as image:
                detected_format = (image.format or "").upper().strip()
        except UnidentifiedImageError:
            raise HTTPException(status_code=400, detail="Invalid image file.") from None
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image file.") from None

        detected = IMAGE_FORMAT_TO_MIME_EXT.get(detected_format)
        if not detected:
            raise HTTPException(status_code=400, detail="Unsupported image format.")

        detected_type, _detected_ext = detected
        if detected_type not in ALLOWED_IMAGE_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Unsupported image format.")

        source_ext = Path(file.filename or "").suffix.lower()
        extension = source_ext or ""
        return detected_type, extension, detected_format

    async def upload_image(
        self,
        path_prefix: str,
        file: UploadFile,
        max_width: int | None = None,
        max_height: int | None = None,
        crop: bool = False,
        overwrite_name: str | None = None,
    ) -> str:
        content = await file.read()
        if len(content) > MAX_IMAGE_SIZE_BYTES:
            raise HTTPException(status_code=413, detail="Image file too large (max 8MB).")

        content_type, ext, output_format = self._resolve_image_metadata(file, content)
        if max_width or max_height:
            content = compress_image(
                content,
                max_width=max_width,
                max_height=max_height,
                crop=crop,
                output_format=output_format,
            )

        if overwrite_name:
            overwrite_path = Path(overwrite_name)
            filename = overwrite_name if overwrite_path.suffix else f"{overwrite_name}{ext}"
        else:
            filename = f"{uuid4()}{ext}" if ext else str(uuid4())
        object_path = f"{path_prefix}/{filename}"
        blob = self._bucket().blob(object_path)
        blob.upload_from_string(content, content_type=content_type)
        blob.make_public()
        return blob.public_url

    def delete_by_prefix(self, prefix: str) -> int:
        deleted = 0
        for blob in self._bucket().list_blobs(prefix=prefix):
            blob.delete()
            deleted += 1
        return deleted

    def delete_unreferenced_blobs(self, prefix: str, used_urls: set[str]) -> int:
        normalized_used: set[str] = set()
        for url in used_urls:
            normalized_used.add(url)
            parts = urlsplit(url)
            normalized_used.add(urlunsplit((parts.scheme, parts.netloc, parts.path, "", "")))

        deleted = 0
        for blob in self._bucket().list_blobs(prefix=prefix):
            blob_url = blob.public_url
            parts = urlsplit(blob_url)
            blob_url_without_query = urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
            if blob_url not in normalized_used and blob_url_without_query not in normalized_used:
                blob.delete()
                deleted += 1
        return deleted

    def delete_first_existing(self, object_paths: list[str]) -> bool:
        for object_path in object_paths:
            blob = self._bucket().blob(object_path)
            if blob.exists():
                blob.delete()
                return True
        return False

storage_service = StorageService()
