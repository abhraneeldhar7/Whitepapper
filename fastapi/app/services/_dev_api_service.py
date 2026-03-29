import hashlib
import logging
import pickle
from uuid import uuid4

from fastapi import HTTPException
from redis import Redis

from app.core.cache_policies import API_KEY_CACHE_POLICY
from app.core.constants import API_KEY_LIMIT_PER_MONTH
from app.core.firestore_store import firestore_store, utc_now
from app.core.redis_client import get_cache_prefix, get_redis_client

logger = logging.getLogger(__name__)

API_KEYS_COLLECTION = "apiKeys"
API_KEY_ID_KEY = "keyId"
API_KEY_HASH_KEY = "keyHash"


class DevApiService:
    def _redis(self) -> Redis | None:
        return get_redis_client()

    def _doc_cache_key(self, key_hash: str) -> str:
        return f"{get_cache_prefix()}:api_keys:doc:{key_hash}"

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
            raise HTTPException(status_code=409, detail="A key already exists for this project. Delete it first.")

        raw_key = f"wp_{uuid4().hex}"
        key_id = str(uuid4())
        key_hash = self.hash_raw_key(raw_key)
        created = {
            API_KEY_ID_KEY: key_id,
            "ownerId": owner_id,
            "projectId": project_id,
            API_KEY_HASH_KEY: key_hash,
            "usage": 0,
            "limitPerMonth": API_KEY_LIMIT_PER_MONTH,
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

    def validate_key(self, raw_key: str) -> dict:
        key_hash = self.hash_raw_key(raw_key)
        client = self._redis()
        key_doc = self._read_doc_by_hash(key_hash, client=client)
        if not key_doc:
            raise HTTPException(status_code=401, detail="Invalid API key.")

        if not key_doc.get("isActive", True):
            raise HTTPException(status_code=403, detail="API key is inactive.")

        usage = int(key_doc.get("usage", 0))
        limit = int(key_doc.get("limitPerMonth", API_KEY_LIMIT_PER_MONTH))
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
        pattern = f"{get_cache_prefix()}:api_keys:doc:*"
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
        client = self._redis()
        all_keys = firestore_store.list_all(API_KEYS_COLLECTION)
        count = 0
        for key in all_keys:
            should_reset = int(key.get("usage", 0)) > 0
            key_hash = key.get(API_KEY_HASH_KEY)
            if client and key_hash:
                cached_doc = self._read_cached_doc(key_hash, client=client)
                if cached_doc:
                    if int(cached_doc.get("usage", 0)) > 0:
                        should_reset = True
                    cached_doc["usage"] = 0
                    self._write_cached_doc(cached_doc, client=client)

            if not should_reset:
                continue

            key_id = key.get(API_KEY_ID_KEY)
            if key_id:
                firestore_store.update(API_KEYS_COLLECTION, key_id, {"usage": 0})
                count += 1
        return count


_dev_api_service = DevApiService()
