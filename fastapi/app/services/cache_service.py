from __future__ import annotations

import logging
import pickle
from typing import Any

from redis import Redis

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self) -> None:
        self._client: Redis | None = None
        self._prefix = "whitepapper"

    def configure(self, client: Redis | None, prefix: str | None = None) -> None:
        self._client = client
        if prefix:
            self._prefix = prefix

    def _key(self, namespace: str, *parts: str) -> str:
        clean_parts = [str(part).strip() for part in parts if str(part).strip()]
        suffix = ":".join(clean_parts)
        return f"{self._prefix}:{namespace}:{suffix}" if suffix else f"{self._prefix}:{namespace}"

    def build_key(self, namespace: str, *parts: str) -> str:
        return self._key(namespace, *parts)

    def get(self, key: str) -> Any | None:
        if not self._client:
            return None
        try:
            payload = self._client.get(key)
            if payload is None:
                return None
            return pickle.loads(payload)
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache get failed for key=%s", key)
            return None

    def set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if not self._client:
            return
        try:
            self._client.setex(key, ttl_seconds, pickle.dumps(value))
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache set failed for key=%s", key)

    def delete_many(self, *keys: str) -> None:
        if not self._client:
            return
        to_delete = [key for key in keys if key]
        if not to_delete:
            return
        try:
            self._client.delete(*to_delete)
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache delete failed for keys=%s", to_delete)

    def get_int(self, key: str) -> int | None:
        if not self._client:
            return None
        try:
            value = self._client.get(key)
            if value is None:
                return None
            if isinstance(value, bytes):
                value = value.decode("utf-8")
            return int(value)
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache int get failed for key=%s", key)
            return None

    def set_int(self, key: str, value: int, ttl_seconds: int) -> None:
        if not self._client:
            return
        try:
            self._client.setex(key, ttl_seconds, int(value))
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache int set failed for key=%s", key)

    def incr_int(self, key: str, amount: int, ttl_seconds: int) -> int | None:
        if not self._client:
            return None
        try:
            value = int(self._client.incrby(key, amount))
            ttl = self._client.ttl(key)
            if ttl is None or int(ttl) < 0:
                self._client.expire(key, ttl_seconds)
            return value
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache int incr failed for key=%s", key)
            return None

    def add_to_set(self, key: str, value: str, ttl_seconds: int | None = None) -> None:
        if not self._client:
            return
        try:
            self._client.sadd(key, value)
            if ttl_seconds:
                self._client.expire(key, ttl_seconds)
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache set add failed for key=%s", key)

    def remove_from_set(self, key: str, value: str) -> None:
        if not self._client:
            return
        try:
            self._client.srem(key, value)
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache set remove failed for key=%s", key)

    def get_set_members(self, key: str) -> set[str]:
        if not self._client:
            return set()
        try:
            values = self._client.smembers(key)
            members: set[str] = set()
            for value in values:
                if isinstance(value, bytes):
                    members.add(value.decode("utf-8"))
                else:
                    members.add(str(value))
            return members
        except Exception:  # pragma: no cover - cache failures should not break request flow
            logger.exception("Cache set read failed for key=%s", key)
            return set()


cache_service = CacheService()
