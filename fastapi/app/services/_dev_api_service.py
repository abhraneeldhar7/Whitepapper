import asyncio
import hashlib
import logging
from uuid import uuid4

from fastapi import HTTPException

from app.core.cache_policies import API_KEY_CACHE_POLICY
from app.core.constants import API_KEY_LIMIT_PER_MONTH
from app.core.firestore_store import firestore_store, utc_now
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)


class DevApiService:
    @staticmethod
    def _cache_available() -> bool:
        return getattr(cache_service, "_client", None) is not None

    def _cache_key_by_hash(self, key_hash: str) -> str:
        return cache_service.build_key(API_KEY_CACHE_POLICY.namespace, "doc", key_hash)

    def _usage_key_by_hash(self, key_hash: str) -> str:
        return cache_service.build_key(API_KEY_CACHE_POLICY.namespace, "usage", key_hash)

    def _hash_index_key(self) -> str:
        return cache_service.build_key(API_KEY_CACHE_POLICY.namespace, "hashes")

    @staticmethod
    def _public_doc(doc: dict) -> dict:
        return {key: value for key, value in doc.items() if key != "keyHash"}

    def _set_doc_cache(self, key_doc: dict) -> None:
        key_hash = key_doc.get("keyHash")
        if not key_hash:
            return
        cache_service.set(self._cache_key_by_hash(key_hash), key_doc, API_KEY_CACHE_POLICY.ttl_seconds)
        cache_service.set_int(
            self._usage_key_by_hash(key_hash),
            int(key_doc.get("usage", 0)),
            API_KEY_CACHE_POLICY.ttl_seconds,
        )
        cache_service.add_to_set(self._hash_index_key(), key_hash, API_KEY_CACHE_POLICY.ttl_seconds)

    def _invalidate_by_hash(self, key_hash: str | None) -> None:
        if not key_hash:
            return
        cache_service.delete_many(
            self._cache_key_by_hash(key_hash),
            self._usage_key_by_hash(key_hash),
        )
        cache_service.remove_from_set(self._hash_index_key(), key_hash)

    def _load_doc_by_hash(self, key_hash: str) -> dict | None:
        cached = cache_service.get(self._cache_key_by_hash(key_hash))
        if isinstance(cached, dict):
            return cached

        matches = firestore_store.find_by_fields("apiKeys", {"keyHash": key_hash})
        key_doc = matches[0] if matches else None
        if key_doc:
            self._set_doc_cache(key_doc)
        return key_doc

    @staticmethod
    def _increment_firestore_usage_by_hash(key_hash: str) -> None:
        matches = firestore_store.find_by_fields("apiKeys", {"keyHash": key_hash})
        key_doc = matches[0] if matches else None
        if not key_doc:
            return
        key_id = key_doc.get("keyId")
        if key_id:
            firestore_store.increment("apiKeys", key_id, "usage", 1)

    def create(self, owner_id: str, project_id: str) -> dict:
        existing = firestore_store.find_by_fields("apiKeys", {"projectId": project_id})
        if existing:
            raise HTTPException(status_code=409, detail="A key already exists for this project. Delete it first.")

        raw_key = f"wp_{uuid4().hex}"
        key_id = str(uuid4())
        key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        created = firestore_store.create(
            "apiKeys",
            {
                "keyId": key_id,
                "ownerId": owner_id,
                "projectId": project_id,
                "keyHash": key_hash,
                "usage": 0,
                "limitPerMonth": API_KEY_LIMIT_PER_MONTH,
                "isActive": True,
                "createdAt": utc_now(),
            },
            doc_id=key_id,
        )
        self._set_doc_cache(created)
        public_doc = self._public_doc(created)
        public_doc["rawKey"] = raw_key
        return public_doc

    def toggle_active(self, key_id: str, owner_id: str, is_active: bool) -> dict:
        current = firestore_store.get("apiKeys", key_id)
        if not current:
            raise HTTPException(status_code=404, detail="API key not found.")
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        firestore_store.update("apiKeys", key_id, {"isActive": is_active})
        current["isActive"] = is_active
        self._invalidate_by_hash(current.get("keyHash"))
        return self._public_doc(current)

    def delete(self, key_id: str, owner_id: str) -> dict[str, bool]:
        current = firestore_store.get("apiKeys", key_id)
        if not current:
            raise HTTPException(status_code=404, detail="API key not found.")
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
        firestore_store.delete("apiKeys", key_id)
        self._invalidate_by_hash(current.get("keyHash"))
        return {"ok": True}

    @staticmethod
    def hash_raw_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def validate_key(self, raw_key: str) -> dict:
        key_hash = self.hash_raw_key(raw_key)
        if not self._cache_available():
            matches = firestore_store.find_by_fields("apiKeys", {"keyHash": key_hash})
            key_doc = matches[0] if matches else None
        else:
            key_doc = self._load_doc_by_hash(key_hash)
        if not key_doc:
            raise HTTPException(status_code=401, detail="Invalid API key.")

        if not key_doc.get("isActive", True):
            self._invalidate_by_hash(key_hash)
            raise HTTPException(status_code=403, detail="API key is inactive.")

        if not self._cache_available():
            usage = int(key_doc.get("usage", 0))
        else:
            usage = cache_service.get_int(self._usage_key_by_hash(key_hash))
            if usage is None:
                usage = int(key_doc.get("usage", 0))
                cache_service.set_int(self._usage_key_by_hash(key_hash), usage, API_KEY_CACHE_POLICY.ttl_seconds)

        limit = int(key_doc.get("limitPerMonth", API_KEY_LIMIT_PER_MONTH))
        if usage >= limit:
            raise HTTPException(status_code=429, detail="Monthly API limit exceeded.")

        response_doc = dict(key_doc)
        response_doc["usage"] = usage
        return response_doc

    def increment_usage(self, key_hash: str | None) -> None:
        if not key_hash:
            return
        try:
            if not self._cache_available():
                self._increment_firestore_usage_by_hash(key_hash)
                return

            key_doc = self._load_doc_by_hash(key_hash)
            if not key_doc:
                return
            usage = cache_service.incr_int(
                self._usage_key_by_hash(key_hash),
                1,
                API_KEY_CACHE_POLICY.ttl_seconds,
            )
            if usage is None:
                self._increment_firestore_usage_by_hash(key_hash)
                return
            cache_service.set_int(
                self._usage_key_by_hash(key_hash),
                usage,
                API_KEY_CACHE_POLICY.ttl_seconds,
            )
            cache_service.add_to_set(self._hash_index_key(), key_hash, API_KEY_CACHE_POLICY.ttl_seconds)
        except Exception:  # pragma: no cover
            logger.exception("Failed to increment API key usage in cache")
            self._increment_firestore_usage_by_hash(key_hash)

    def get_project_api_key(self, project_id: str, owner_id: str) -> dict | None:
        matches = firestore_store.find_by_fields("apiKeys", {"projectId": project_id, "ownerId": owner_id})
        key_doc = matches[0] if matches else None
        if not key_doc:
            return None

        key_hash = key_doc.get("keyHash")
        if key_hash:
            cached_doc = cache_service.get(self._cache_key_by_hash(key_hash))
            if isinstance(cached_doc, dict):
                key_doc = cached_doc
            else:
                self._set_doc_cache(key_doc)

            usage = cache_service.get_int(self._usage_key_by_hash(key_hash))
            if usage is None:
                usage = int(key_doc.get("usage", 0))
                cache_service.set_int(self._usage_key_by_hash(key_hash), usage, API_KEY_CACHE_POLICY.ttl_seconds)
            key_doc = dict(key_doc)
            key_doc["usage"] = usage

        return self._public_doc(key_doc)

    def sync_cache_with_firestore(self) -> int:
        synced = 0
        for key_hash in cache_service.get_set_members(self._hash_index_key()):
            key_doc = cache_service.get(self._cache_key_by_hash(key_hash))
            if not isinstance(key_doc, dict):
                key_doc = self._load_doc_by_hash(key_hash)
                if not key_doc:
                    self._invalidate_by_hash(key_hash)
                    continue

            key_id = key_doc.get("keyId")
            if not key_id:
                self._invalidate_by_hash(key_hash)
                continue

            usage = cache_service.get_int(self._usage_key_by_hash(key_hash))
            if usage is None:
                usage = int(key_doc.get("usage", 0))
                cache_service.set_int(self._usage_key_by_hash(key_hash), usage, API_KEY_CACHE_POLICY.ttl_seconds)

            firestore_store.update("apiKeys", key_id, {"usage": usage})
            key_doc["usage"] = usage
            cache_service.set(self._cache_key_by_hash(key_hash), key_doc, API_KEY_CACHE_POLICY.ttl_seconds)
            cache_service.set_int(self._usage_key_by_hash(key_hash), usage, API_KEY_CACHE_POLICY.ttl_seconds)
            cache_service.add_to_set(self._hash_index_key(), key_hash, API_KEY_CACHE_POLICY.ttl_seconds)
            synced += 1

        return synced

    async def run_hourly_cache_sync(self, stop_event: asyncio.Event) -> None:
        while not stop_event.is_set():
            try:
                self.sync_cache_with_firestore()
            except Exception:  # pragma: no cover
                logger.exception("Hourly API key cache sync failed")
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=60 * 60)
            except asyncio.TimeoutError:
                continue

    def reset_all_usage(self) -> int:
        all_keys = firestore_store.list_all("apiKeys")
        count = 0
        for key in all_keys:
            key_id = key.get("keyId")
            if not key_id:
                continue
            if int(key.get("usage", 0)) <= 0:
                continue
            firestore_store.update("apiKeys", key_id, {"usage": 0})
            self._invalidate_by_hash(key.get("keyHash"))
            count += 1
        return count


_dev_api_service = DevApiService()
