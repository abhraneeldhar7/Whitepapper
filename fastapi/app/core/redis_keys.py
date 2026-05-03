from __future__ import annotations

import logging
from datetime import datetime

from redis import Redis

from app.core.redis_client import get_redis_client

logger = logging.getLogger(__name__)

NAMESPACE = "whitepapper"

API_KEY_CACHE_TTL = 6 * 60 * 60


def _client() -> Redis | None:
    return get_redis_client()


def _ns_key(*segments: str) -> str:
    return ":".join((NAMESPACE, *segments))


# ── API key key builders ──────────────────────────────────────────────

def api_key_doc(key_hash: str) -> str:
    return _ns_key("api_keys", key_hash)


# ── API key read ──────────────────────────────────────────────────────

def get_api_key(key_hash: str) -> dict | None:
    """Read cached API key doc from Redis. Returns None if missing or Redis unavailable."""
    r = _client()
    if r is None:
        return None
    try:
        raw = r.hgetall(api_key_doc(key_hash))
        if not raw:
            return None
        return _decode_hash(raw)
    except Exception:
        logger.exception("Redis read failed for api_key %s", key_hash)
        return None


# ── API key write ─────────────────────────────────────────────────────

def set_api_key(key_hash: str, doc: dict) -> None:
    """Cache an API key doc in Redis with TTL. Overwrites any existing key (handles type migrations)."""
    r = _client()
    if r is None:
        return
    try:
        mapping = _encode_hash(doc)
        key = api_key_doc(key_hash)
        r.delete(key)
        r.hset(key, mapping=mapping)
        r.expire(key, API_KEY_CACHE_TTL)
    except Exception:
        logger.exception("Redis write failed for api_key %s", key_hash)


# ── API key usage (atomic) ─────────────────────────────────────────────

def incr_api_key_usage(key_hash: str) -> int | None:
    """Atomically increment the usage counter. Returns the new value or None."""
    r = _client()
    if r is None:
        return None
    try:
        return r.hincrby(api_key_doc(key_hash), "usage", 1)
    except Exception:
        return None


# ── API key delete ────────────────────────────────────────────────────

def delete_api_key(key_hash: str) -> None:
    """Remove a cached API key from Redis."""
    r = _client()
    if r is None:
        return
    try:
        r.delete(api_key_doc(key_hash))
    except Exception:
        logger.exception("Redis delete failed for api_key %s", key_hash)


# ── API key TTL refresh ───────────────────────────────────────────────

def refresh_api_key_ttl(key_hash: str) -> None:
    """Reset the TTL on a cached API key doc."""
    r = _client()
    if r is None:
        return
    try:
        r.expire(api_key_doc(key_hash), API_KEY_CACHE_TTL)
    except Exception:
        logger.exception("Redis EXPIRE failed for api_key %s", key_hash)


# ── Scan cached API key hashes ────────────────────────────────────────

def scan_api_key_hashes() -> list[str]:
    """Return all keyHash values currently cached in Redis."""
    r = _client()
    if r is None:
        return []
    try:
        hashes: list[str] = []
        for key in r.scan_iter(match=_ns_key("api_keys", "*")):
            decoded = key.decode() if isinstance(key, bytes) else key
            parts = decoded.rsplit(":", 1)
            if len(parts) == 2:
                hashes.append(parts[1])
        return hashes
    except Exception:
        logger.exception("Redis SCAN failed for api_keys")
        return []


# ── Internal codec helpers ────────────────────────────────────────────

def _encode_hash(doc: dict) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for k, v in doc.items():
        if v is None:
            continue
        if isinstance(v, bool):
            mapping[k] = "1" if v else "0"
        elif isinstance(v, datetime):
            mapping[k] = v.isoformat()
        else:
            mapping[k] = str(v)
    return mapping


def _decode_hash(raw: dict[bytes, bytes]) -> dict:
    doc: dict = {}
    for k, v in raw.items():
        key = k.decode() if isinstance(k, bytes) else k
        val = v.decode() if isinstance(v, bytes) else v
        if key == "usage":
            doc[key] = int(val) if val.lstrip("-").isdigit() else 0
        elif key == "limitPerMonth":
            doc[key] = int(val) if val.lstrip("-").isdigit() else 0
        elif key == "isActive":
            doc[key] = val == "1"
        else:
            doc[key] = val
    return doc
