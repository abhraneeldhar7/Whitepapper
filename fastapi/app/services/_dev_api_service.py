import hashlib
import logging
import pickle
from uuid import uuid4

from fastapi import HTTPException
from redis import Redis

from app.core.cache_policies import API_KEY_CACHE_POLICY
from app.core.limits import DEV_API_LIMIT_PER_MONTH
from app.core.firestore_store import firestore_store
from app.core.redis_client import get_cache_prefix, get_redis_client
from app.utils.datetime import utc_now

logger = logging.getLogger(__name__)

API_KEYS_COLLECTION = "apiKeys"
API_KEY_ID_KEY = "keyId"
API_KEY_HASH_KEY = "keyHash"


class DevApiService:
    def _redis(self) -> Redis | None:
        return get_redis_client()

    def _doc_cache_key(self, key_hash: str) -> str:
        return f"{get_cache_prefix()}:api_keys:{key_hash}"

    def _read_cached_doc(self, key_hash: str, client: Redis | None = None) -> dict | None:
        client = client or self._redis()
        if not client:
            return None
        try:
            payload = client.get(self._doc_cache_key(key_hash))
            if payload is None:
                return None
            value = pickle.loads(payload)
            return value if isinstance(value, dict) else None
        except Exception:
            logger.exception("API key cache read failed for key_hash=%s", key_hash)
            return None

    def _write_cached_doc(self, doc: dict, client: Redis | None = None) -> None:
        client = client or self._redis()
        if not client:
            return
        key_hash = doc.get(API_KEY_HASH_KEY)
        if not key_hash:
            return
        try:
            client.setex(
                self._doc_cache_key(key_hash),
                API_KEY_CACHE_POLICY.ttl_seconds,
                pickle.dumps(doc),
            )
        except Exception:
            logger.exception("API key cache write failed for key_hash=%s", key_hash)

    def _read_doc_by_hash(self, key_hash: str, client: Redis | None = None) -> dict | None:
        cached = self._read_cached_doc(key_hash, client=client)
        if cached:
            return cached

        matches = firestore_store.find_by_fields(API_KEYS_COLLECTION, {API_KEY_HASH_KEY: key_hash})
        doc = matches[0] if matches else None
        if doc:
            self._write_cached_doc(doc, client=client)
        return doc

    @staticmethod
    def _public_doc(doc: dict) -> dict:
        return {key: value for key, value in doc.items() if key != API_KEY_HASH_KEY}

    @staticmethod
    def hash_raw_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def get_by_id(self, key_id: str) -> dict:
        key_doc = firestore_store.get(API_KEYS_COLLECTION, key_id)
        if not key_doc:
            raise HTTPException(status_code=404, detail="API key not found.")
        return key_doc

    def create(self, owner_id: str, project_id: str) -> dict:
        existing = firestore_store.find_by_fields(API_KEYS_COLLECTION, {"projectId": project_id})
        if existing:
            raise HTTPException(status_code=409, detail="A key already exists for this project.")

        raw_key = f"wp_{uuid4().hex}"
        key_id = str(uuid4())
        key_hash = self.hash_raw_key(raw_key)
        created = {
            API_KEY_ID_KEY: key_id,
            "ownerId": owner_id,
            "projectId": project_id,
            API_KEY_HASH_KEY: key_hash,
            "usage": 0,
            "limitPerMonth": DEV_API_LIMIT_PER_MONTH,
            "isActive": True,
            "createdAt": utc_now(),
        }
        firestore_store.create(API_KEYS_COLLECTION, created, doc_id=key_id)
        self._write_cached_doc(created)

        public_doc = self._public_doc(created)
        public_doc["rawKey"] = raw_key
        return public_doc

    def toggle_active(self, key_id: str, is_active: bool) -> dict:
        current = self.get_by_id(key_id)
        target = bool(is_active)
        current["isActive"] = target
        firestore_store.update(API_KEYS_COLLECTION, key_id, current)

        key_hash = current.get(API_KEY_HASH_KEY)
        client = self._redis()
        if client and key_hash:
            try:
                client.delete(self._doc_cache_key(key_hash))
            except Exception:
                logger.exception("API key cache delete failed for key_hash=%s", key_hash)

        return self._public_doc(current)

    def delete(self, key_id: str) -> dict[str, bool]:
        current = self.get_by_id(key_id)
        key_hash = current.get(API_KEY_HASH_KEY)
        client = self._redis()
        firestore_store.delete(API_KEYS_COLLECTION, key_id)
        if client and key_hash:
            try:
                client.delete(self._doc_cache_key(key_hash))
            except Exception:
                logger.exception("API key cache delete failed for key_hash=%s", key_hash)
        return {"ok": True}

    def delete_by_project(self, project_id: str) -> int:
        deleted = 0
        for key_doc in firestore_store.find_by_fields(API_KEYS_COLLECTION, {"projectId": project_id}):
            key_id = str(key_doc.get(API_KEY_ID_KEY) or "").strip()
            if not key_id:
                continue
            self.delete(key_id)
            deleted += 1
        return deleted

    def delete_by_owner(self, owner_id: str) -> int:
        deleted = 0
        for key_doc in firestore_store.find_by_fields(API_KEYS_COLLECTION, {"ownerId": owner_id}):
            key_id = str(key_doc.get(API_KEY_ID_KEY) or "").strip()
            if not key_id:
                continue
            self.delete(key_id)
            deleted += 1
        return deleted

    def reset(self, key_id: str) -> dict:
        current = self.get_by_id(key_id)
        old_hash = current.get(API_KEY_HASH_KEY)
        client = self._redis()

        # Prefer cache doc when present, then persist rotated hash to Firestore.
        cached_doc = self._read_cached_doc(old_hash, client=client) if old_hash else None
        next_doc = dict(cached_doc or current)

        raw_key = f"wp_{uuid4().hex}"
        next_doc[API_KEY_HASH_KEY] = self.hash_raw_key(raw_key)

        firestore_store.update(API_KEYS_COLLECTION, key_id, next_doc)

        if client and old_hash:
            try:
                client.delete(self._doc_cache_key(old_hash))
            except Exception:
                logger.exception("API key cache delete failed for key_hash=%s", old_hash)

        self._write_cached_doc(next_doc, client=client)

        public_doc = self._public_doc(next_doc)
        public_doc["rawKey"] = raw_key
        return public_doc

    def validate_key(self, raw_key: str) -> dict:
        key_hash = self.hash_raw_key(raw_key)
        client = self._redis()
        key_doc = self._read_doc_by_hash(key_hash, client=client)
        if not key_doc:
            raise HTTPException(status_code=401, detail="Invalid API key.")

        if not key_doc.get("isActive", True):
            raise HTTPException(status_code=403, detail="API key is inactive.")

        usage = int(key_doc.get("usage", 0))
        limit = int(key_doc.get("limitPerMonth", DEV_API_LIMIT_PER_MONTH))
        if usage >= limit:
            raise HTTPException(status_code=429, detail="Monthly API limit exceeded.")

        return key_doc

    def increment_usage(self, key_hash: str | None) -> None:
        if not key_hash:
            return
        client = self._redis()
        if not client:
            return

        key_doc = self._read_cached_doc(key_hash, client=client)
        if not key_doc:
            return

        key_doc["usage"] = int(key_doc.get("usage", 0)) + 1
        self._write_cached_doc(key_doc, client=client)

    def get_project_api_key(self, project_id: str, owner_id: str) -> dict | None:
        matches = firestore_store.find_by_fields(
            API_KEYS_COLLECTION,
            {"projectId": project_id, "ownerId": owner_id},
        )
        key_doc = matches[0] if matches else None
        if not key_doc:
            return None

        key_hash = key_doc.get(API_KEY_HASH_KEY)
        client = self._redis()
        if key_hash:
            cached_doc = self._read_cached_doc(key_hash, client=client)
            if cached_doc:
                key_doc = cached_doc
            else:
                self._write_cached_doc(key_doc, client=client)

        return self._public_doc(key_doc)

    def sync_cache_with_firestore(self) -> int:
        client = self._redis()
        if not client:
            return 0

        synced = 0
        pattern = f"{get_cache_prefix()}:api_keys:*"
        for key in client.scan_iter(match=pattern):
            try:
                payload = client.get(key)
                if payload is None:
                    continue
                cached_doc = pickle.loads(payload)
                if not isinstance(cached_doc, dict):
                    continue
            except Exception:
                logger.exception("API key cache read failed for key=%s", key)
                continue

            key_id = cached_doc.get(API_KEY_ID_KEY)
            if not key_id:
                continue
            try:
                firestore_store.update(
                    API_KEYS_COLLECTION,
                    key_id,
                    {"usage": int(cached_doc.get("usage", 0))},
                )
            except Exception:
                logger.exception("API key firestore sync failed for key_id=%s", key_id)
                continue
            synced += 1
        return synced

    def reset_all_usage(self) -> int:
        all_keys = firestore_store.list_all(API_KEYS_COLLECTION)
        key_ids: list[str] = []
        for key in all_keys:
            key_id = key.get(API_KEY_ID_KEY)
            if key_id:
                firestore_store.update(API_KEYS_COLLECTION, key_id, {"usage": 0})
                key_ids.append(key_id)

        client = self._redis()
        if client:
            pattern = f"{get_cache_prefix()}:api_keys:*"
            try:
                keys = list(client.scan_iter(match=pattern))
                if keys:
                    client.delete(*keys)
            except Exception:
                logger.exception("API key cache reset failed.")

        return len(key_ids)


_dev_api_service = DevApiService()
