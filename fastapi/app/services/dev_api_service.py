import hashlib
import json
import logging
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

    def _doc_cache_key(self, keyHash: str) -> str:
        return f"{get_cache_prefix()}:api_keys:{keyHash}"

    def _read_cachedDoc(self, keyHash: str, client: Redis | None = None) -> dict | None:
        client = client or self._redis()
        if not client:
            return None
        try:
            payload = client.get(self._doc_cache_key(keyHash))
            if payload is None:
                return None
            value = json.loads(payload)
            return value if isinstance(value, dict) else None
        except Exception:
            logger.exception("API key cache read failed for keyHash=%s", keyHash)
            return None

    def _write_cachedDoc(self, doc: dict, client: Redis | None = None) -> None:
        client = client or self._redis()
        if not client:
            return
        keyHash = doc.get(API_KEY_HASH_KEY)
        if not keyHash:
            return
        try:
            client.setex(
                self._doc_cache_key(keyHash),
                API_KEY_CACHE_POLICY.ttl_seconds,
                json.dumps(doc).encode("utf-8"),
            )
        except Exception:
            logger.exception("API key cache write failed for keyHash=%s", keyHash)

    def _read_doc_by_hash(self, keyHash: str, client: Redis | None = None) -> dict | None:
        cached = self._read_cachedDoc(keyHash, client=client)
        if cached:
            return cached

        matches = firestore_store.find_by_fields(API_KEYS_COLLECTION, {API_KEY_HASH_KEY: keyHash})
        doc = matches[0] if matches else None
        if doc:
            self._write_cachedDoc(doc, client=client)
        return doc

    @staticmethod
    def _publicDoc(doc: dict) -> dict:
        return {key: value for key, value in doc.items() if key != API_KEY_HASH_KEY}

    @staticmethod
    def hash_rawKey(rawKey: str) -> str:
        return hashlib.sha256(rawKey.encode("utf-8")).hexdigest()

    def get_by_id(self, keyId: str) -> dict:
        keyDoc = firestore_store.get(API_KEYS_COLLECTION, keyId)
        if not keyDoc:
            raise HTTPException(status_code=404, detail="API key not found.")
        return keyDoc

    def create(self, ownerId: str, projectId: str) -> dict:
        existing = firestore_store.find_by_fields(API_KEYS_COLLECTION, {"projectId": projectId})
        if existing:
            raise HTTPException(status_code=409, detail="A key already exists for this project.")

        rawKey = f"wp_{uuid4().hex}"
        keyId = str(uuid4())
        keyHash = self.hash_rawKey(rawKey)
        created = {
            API_KEY_ID_KEY: keyId,
            "ownerId": ownerId,
            "projectId": projectId,
            API_KEY_HASH_KEY: keyHash,
            "usage": 0,
            "limitPerMonth": DEV_API_LIMIT_PER_MONTH,
            "isActive": True,
            "createdAt": utc_now(),
        }
        firestore_store.create(API_KEYS_COLLECTION, created, doc_id=keyId)
        self._write_cachedDoc(created)

        publicDoc = self._publicDoc(created)
        publicDoc["rawKey"] = rawKey
        return publicDoc

    def toggle_active(self, keyId: str, isActive: bool) -> dict:
        current = self.get_by_id(keyId)
        target = bool(isActive)
        current["isActive"] = target
        firestore_store.update(API_KEYS_COLLECTION, keyId, current)

        keyHash = current.get(API_KEY_HASH_KEY)
        client = self._redis()
        if client and keyHash:
            try:
                client.delete(self._doc_cache_key(keyHash))
            except Exception:
                logger.exception("API key cache delete failed for keyHash=%s", keyHash)

        return self._publicDoc(current)

    def delete(self, keyId: str) -> dict[str, bool]:
        current = self.get_by_id(keyId)
        keyHash = current.get(API_KEY_HASH_KEY)
        client = self._redis()
        firestore_store.delete(API_KEYS_COLLECTION, keyId)
        if client and keyHash:
            try:
                client.delete(self._doc_cache_key(keyHash))
            except Exception:
                logger.exception("API key cache delete failed for keyHash=%s", keyHash)
        return {"ok": True}

    def delete_by_project(self, projectId: str) -> int:
        deleted = 0
        for keyDoc in firestore_store.find_by_fields(API_KEYS_COLLECTION, {"projectId": projectId}):
            keyId = str(keyDoc.get(API_KEY_ID_KEY) or "").strip()
            if not keyId:
                continue
            self.delete(keyId)
            deleted += 1
        return deleted

    def delete_by_owner(self, ownerId: str) -> int:
        deleted = 0
        for keyDoc in firestore_store.find_by_fields(API_KEYS_COLLECTION, {"ownerId": ownerId}):
            keyId = str(keyDoc.get(API_KEY_ID_KEY) or "").strip()
            if not keyId:
                continue
            self.delete(keyId)
            deleted += 1
        return deleted

    def reset(self, keyId: str) -> dict:
        current = self.get_by_id(keyId)
        oldHash = current.get(API_KEY_HASH_KEY)
        client = self._redis()

        cachedDoc = self._read_cachedDoc(oldHash, client=client) if oldHash else None
        nextDoc = dict(cachedDoc or current)

        rawKey = f"wp_{uuid4().hex}"
        nextDoc[API_KEY_HASH_KEY] = self.hash_rawKey(rawKey)

        firestore_store.update(API_KEYS_COLLECTION, keyId, nextDoc)

        if client and oldHash:
            try:
                client.delete(self._doc_cache_key(oldHash))
            except Exception:
                logger.exception("API key cache delete failed for keyHash=%s", oldHash)

        self._write_cachedDoc(nextDoc, client=client)

        publicDoc = self._publicDoc(nextDoc)
        publicDoc["rawKey"] = rawKey
        return publicDoc

    def validate_key(self, rawKey: str) -> dict:
        keyHash = self.hash_rawKey(rawKey)
        client = self._redis()
        keyDoc = self._read_doc_by_hash(keyHash, client=client)
        if not keyDoc:
            raise HTTPException(status_code=401, detail="Invalid API key.")

        if not keyDoc.get("isActive", True):
            raise HTTPException(status_code=403, detail="API key is inactive.")

        usage = int(keyDoc.get("usage", 0))
        limit = int(keyDoc.get("limitPerMonth", DEV_API_LIMIT_PER_MONTH))
        if usage >= limit:
            raise HTTPException(status_code=429, detail="Monthly API limit exceeded.")

        return keyDoc

    def increment_usage(self, keyHash: str | None) -> None:
        if not keyHash:
            return
        client = self._redis()
        if not client:
            return

        keyDoc = self._read_cachedDoc(keyHash, client=client)
        if not keyDoc:
            return

        keyDoc["usage"] = int(keyDoc.get("usage", 0)) + 1
        self._write_cachedDoc(keyDoc, client=client)

    def get_project_api_key(self, projectId: str, ownerId: str) -> dict | None:
        matches = firestore_store.find_by_fields(
            API_KEYS_COLLECTION,
            {"projectId": projectId, "ownerId": ownerId},
        )
        keyDoc = matches[0] if matches else None
        if not keyDoc:
            return None

        keyHash = keyDoc.get(API_KEY_HASH_KEY)
        client = self._redis()
        if keyHash:
            cachedDoc = self._read_cachedDoc(keyHash, client=client)
            if cachedDoc:
                keyDoc = cachedDoc
            else:
                self._write_cachedDoc(keyDoc, client=client)

        return self._publicDoc(keyDoc)

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
                cachedDoc = json.loads(payload)
                if not isinstance(cachedDoc, dict):
                    continue
            except Exception:
                logger.exception("API key cache read failed for key=%s", key)
                continue

            keyId = cachedDoc.get(API_KEY_ID_KEY)
            if not keyId:
                continue
            try:
                firestore_store.update(
                    API_KEYS_COLLECTION,
                    keyId,
                    {"usage": int(cachedDoc.get("usage", 0))},
                )
            except Exception:
                logger.exception("API key firestore sync failed for keyId=%s", keyId)
                continue
            synced += 1
        return synced

    def reset_all_usage(self) -> int:
        all_keys = firestore_store.list_all(API_KEYS_COLLECTION)
        keyIds: list[str] = []
        for key in all_keys:
            keyId = key.get(API_KEY_ID_KEY)
            if keyId:
                firestore_store.update(API_KEYS_COLLECTION, keyId, {"usage": 0})
                keyIds.append(keyId)

        client = self._redis()
        if client:
            pattern = f"{get_cache_prefix()}:api_keys:*"
            try:
                keys = list(client.scan_iter(match=pattern))
                if keys:
                    client.delete(*keys)
            except Exception:
                logger.exception("API key cache reset failed.")

        return len(keyIds)


dev_api_service = DevApiService()
