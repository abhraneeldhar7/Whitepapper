import hashlib
import logging
from uuid import uuid4

from fastapi import HTTPException

from app.core.firestore_store import firestore_store
from app.core.limits import DEV_API_LIMIT_PER_MONTH
from app.core.redis_keys import (
    delete_api_key,
    get_api_key,
    incr_api_key_usage,
    refresh_api_key_ttl,
    scan_api_key_hashes,
    set_api_key,
)
from app.utils.datetime import utc_now

logger = logging.getLogger(__name__)

API_KEYS_COLLECTION = "apiKeys"
API_KEY_ID_KEY = "keyId"
API_KEY_HASH_KEY = "keyHash"


class DevApiService:

    # ── firestore helpers ─────────────────────────────────────────────

    @staticmethod
    def _fetch_db(keyHash: str) -> dict | None:
        matches = firestore_store.find_by_fields(API_KEYS_COLLECTION, {API_KEY_HASH_KEY: keyHash})
        return matches[0] if matches else None

    @staticmethod
    def _update_db_usage(keyId: str, usage: int) -> None:
        firestore_store.update(API_KEYS_COLLECTION, keyId, {"usage": usage})

    # ── read-through cache ────────────────────────────────────────────

    def _read_doc_by_hash(self, keyHash: str) -> dict | None:
        cached = get_api_key(keyHash)
        if cached and cached.get(API_KEY_ID_KEY):
            return cached
        doc = self._fetch_db(keyHash)
        if doc:
            if cached:
                doc["usage"] = cached.get("usage", doc.get("usage", 0))
            set_api_key(keyHash, doc)
        return doc

    # ── static helpers ────────────────────────────────────────────────

    @staticmethod
    def _publicDoc(doc: dict) -> dict:
        return {k: v for k, v in doc.items() if k != API_KEY_HASH_KEY}

    @staticmethod
    def hash_rawKey(rawKey: str) -> str:
        return hashlib.sha256(rawKey.encode("utf-8")).hexdigest()

    # ── CRUD ──────────────────────────────────────────────────────────

    def get_by_id(self, keyId: str) -> dict:
        doc = firestore_store.get(API_KEYS_COLLECTION, keyId)
        if not doc:
            raise HTTPException(status_code=404, detail="API key not found.")
        return doc

    def create(self, ownerId: str, projectId: str) -> dict:
        existing = firestore_store.find_by_fields(API_KEYS_COLLECTION, {"projectId": projectId})
        if existing:
            raise HTTPException(status_code=409, detail="A key already exists for this project.")

        rawKey = f"wp_{uuid4().hex}"
        keyId = str(uuid4())
        keyHash = self.hash_rawKey(rawKey)
        doc = {
            API_KEY_ID_KEY: keyId,
            "ownerId": ownerId,
            "projectId": projectId,
            API_KEY_HASH_KEY: keyHash,
            "usage": 0,
            "limitPerMonth": DEV_API_LIMIT_PER_MONTH,
            "isActive": True,
            "createdAt": utc_now(),
        }
        firestore_store.create(API_KEYS_COLLECTION, doc, doc_id=keyId)
        set_api_key(keyHash, doc)

        public = self._publicDoc(doc)
        public["rawKey"] = rawKey
        return public

    def toggle_active(self, keyId: str, isActive: bool) -> dict:
        current = self.get_by_id(keyId)
        keyHash = current.get(API_KEY_HASH_KEY)

        # Copy usage from Redis cache to DB before mutating
        if keyHash:
            cached = get_api_key(keyHash)
            if cached:
                self._update_db_usage(keyId, int(cached.get("usage", 0)))

        current["isActive"] = bool(isActive)
        firestore_store.update(API_KEYS_COLLECTION, keyId, current)

        if keyHash:
            delete_api_key(keyHash)

        return self._publicDoc(current)

    def delete(self, keyId: str) -> dict[str, bool]:
        current = self.get_by_id(keyId)
        keyHash = current.get(API_KEY_HASH_KEY)
        firestore_store.delete(API_KEYS_COLLECTION, keyId)
        if keyHash:
            delete_api_key(keyHash)
        return {"ok": True}

    def delete_by_project(self, projectId: str) -> int:
        deleted = 0
        for doc in firestore_store.find_by_fields(API_KEYS_COLLECTION, {"projectId": projectId}):
            kid = str(doc.get(API_KEY_ID_KEY) or "").strip()
            if not kid:
                continue
            self.delete(kid)
            deleted += 1
        return deleted

    def delete_by_owner(self, ownerId: str) -> int:
        deleted = 0
        for doc in firestore_store.find_by_fields(API_KEYS_COLLECTION, {"ownerId": ownerId}):
            kid = str(doc.get(API_KEY_ID_KEY) or "").strip()
            if not kid:
                continue
            self.delete(kid)
            deleted += 1
        return deleted

    def reset(self, keyId: str) -> dict:
        current = self.get_by_id(keyId)
        oldHash = current.get(API_KEY_HASH_KEY)

        # Copy usage from Redis to DB, then invalidate old cache
        if oldHash:
            cached = get_api_key(oldHash)
            if cached:
                self._update_db_usage(keyId, int(cached.get("usage", 0)))
            delete_api_key(oldHash)

        rawKey = f"wp_{uuid4().hex}"
        newHash = self.hash_rawKey(rawKey)
        current[API_KEY_HASH_KEY] = newHash
        current["usage"] = int(current.get("usage", 0))

        firestore_store.update(API_KEYS_COLLECTION, keyId, current)
        set_api_key(newHash, current)

        public = self._publicDoc(current)
        public["rawKey"] = rawKey
        return public

    # ── validation + usage increment ──────────────────────────────────

    def validate_key(self, rawKey: str) -> dict:
        keyHash = self.hash_rawKey(rawKey)
        keyDoc = self._read_doc_by_hash(keyHash)
        if not keyDoc:
            raise HTTPException(status_code=401, detail="Invalid API key.")

        if not self._truthy(keyDoc.get("isActive")):
            raise HTTPException(status_code=403, detail="API key is inactive.")

        usage = int(keyDoc.get("usage", 0))
        limit = int(keyDoc.get("limitPerMonth", DEV_API_LIMIT_PER_MONTH))
        if usage >= limit:
            raise HTTPException(status_code=429, detail="Monthly API limit exceeded.")

        return keyDoc

    @staticmethod
    def _truthy(value) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ("1", "true", "yes")
        return bool(value)

    def increment_usage(self, keyHash: str | None) -> None:
        if not keyHash:
            return
        
        incr_api_key_usage(keyHash)

    # ── project lookup ────────────────────────────────────────────────

    def get_project_api_key(self, projectId: str, ownerId: str) -> dict | None:
        matches = firestore_store.find_by_fields(
            API_KEYS_COLLECTION,
            {"projectId": projectId, "ownerId": ownerId},
        )
        keyDoc = matches[0] if matches else None
        if not keyDoc:
            return None

        keyHash = keyDoc.get(API_KEY_HASH_KEY)
        if keyHash:
            cached = get_api_key(keyHash)
            if cached:
                keyDoc["usage"] = cached.get("usage", keyDoc.get("usage", 0))
            else:
                set_api_key(keyHash, keyDoc)

        return self._publicDoc(keyDoc)

    # ── scheduled sync ────────────────────────────────────────────────

    def sync_cache_with_firestore(self) -> int:
        synced = 0
        for keyHash in scan_api_key_hashes():
            cached = get_api_key(keyHash)
            if not cached:
                continue
            keyId = cached.get(API_KEY_ID_KEY)
            if not keyId:
                continue
            try:
                self._update_db_usage(keyId, int(cached.get("usage", 0)))
                refresh_api_key_ttl(keyHash)
                synced += 1
            except Exception:
                logger.exception("sync failed for keyId=%s", keyId)
        return synced

    def reset_all_usage(self) -> int:
        all_keys = firestore_store.list_all(API_KEYS_COLLECTION)
        keyIds: list[str] = []
        for key in all_keys:
            kid = key.get(API_KEY_ID_KEY)
            if kid:
                firestore_store.update(API_KEYS_COLLECTION, kid, {"usage": 0})
                keyIds.append(kid)

        for keyHash in scan_api_key_hashes():
            delete_api_key(keyHash)

        return len(keyIds)


dev_api_service = DevApiService()
