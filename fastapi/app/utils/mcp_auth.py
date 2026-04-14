from __future__ import annotations

import hashlib
import logging
import pickle
from datetime import timedelta
from uuid import uuid4

from mcp.server.auth.provider import AccessToken
from redis import Redis

from app.core.limits import MCP_REFRESH_TOKEN_TTL_SECONDS, MCP_TOKEN_LIMIT_PER_MONTH, MCP_TOKEN_TTL_SECONDS
from app.core.firestore_store import firestore_store, utc_now
from app.core.redis_client import get_cache_prefix, get_redis_client

logger = logging.getLogger(__name__)

MCP_TOKENS_COLLECTION = "mcp_tokens"
MCP_REFRESH_TOKENS_COLLECTION = "mcp_refresh_tokens"
MCP_TOKEN_ID_KEY = "tokenId"
MCP_TOKEN_HASH_KEY = "tokenHash"
MCP_REFRESH_TOKEN_ID_KEY = "refreshTokenId"
MCP_REFRESH_TOKEN_HASH_KEY = "refreshTokenHash"


class McpTokenService:
    def _redis(self) -> Redis | None:
        return get_redis_client()

    def _doc_cache_key(self, token_hash: str) -> str:
        return f"{get_cache_prefix()}:mcp_tokens:{token_hash}"

    def _refresh_cache_key(self, token_hash: str) -> str:
        return f"{get_cache_prefix()}:mcp_refresh_tokens:{token_hash}"

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    def _read_cached_doc(self, token_hash: str, client: Redis | None = None) -> dict | None:
        client = client or self._redis()
        if not client:
            return None
        try:
            payload = client.get(self._doc_cache_key(token_hash))
            if payload is None:
                return None
            value = pickle.loads(payload)
            return value if isinstance(value, dict) else None
        except Exception:
            logger.exception("MCP token cache read failed for token_hash=%s", token_hash)
            return None

    def _write_cached_doc(self, doc: dict, client: Redis | None = None) -> None:
        client = client or self._redis()
        if not client:
            return
        token_hash = str(doc.get(MCP_TOKEN_HASH_KEY) or "").strip()
        if not token_hash:
            return
        expires_at = doc.get("expiresAt")
        ttl_seconds = MCP_TOKEN_TTL_SECONDS
        if expires_at:
            try:
                ttl_seconds = max(1, int((expires_at - utc_now()).total_seconds()))
            except Exception:
                ttl_seconds = MCP_TOKEN_TTL_SECONDS
        try:
            client.setex(
                self._doc_cache_key(token_hash),
                ttl_seconds,
                pickle.dumps(doc),
            )
        except Exception:
            logger.exception("MCP token cache write failed for token_hash=%s", token_hash)

    def _delete_cached_doc(self, token_hash: str | None, client: Redis | None = None) -> None:
        if not token_hash:
            return
        client = client or self._redis()
        if not client:
            return
        try:
            client.delete(self._doc_cache_key(token_hash))
        except Exception:
            logger.exception("MCP token cache delete failed for token_hash=%s", token_hash)

    def _read_doc_by_hash(self, token_hash: str, client: Redis | None = None) -> dict | None:
        cached = self._read_cached_doc(token_hash, client=client)
        if cached:
            return cached

        matches = firestore_store.find_by_fields(MCP_TOKENS_COLLECTION, {MCP_TOKEN_HASH_KEY: token_hash})
        doc = matches[0] if matches else None
        if doc:
            self._write_cached_doc(doc, client=client)
        return doc

    def _read_cached_refresh_doc(self, token_hash: str, client: Redis | None = None) -> dict | None:
        client = client or self._redis()
        if not client:
            return None
        try:
            payload = client.get(self._refresh_cache_key(token_hash))
            if payload is None:
                return None
            value = pickle.loads(payload)
            return value if isinstance(value, dict) else None
        except Exception:
            logger.exception("MCP refresh token cache read failed for token_hash=%s", token_hash)
            return None

    def _write_cached_refresh_doc(self, doc: dict, client: Redis | None = None) -> None:
        client = client or self._redis()
        if not client:
            return
        token_hash = str(doc.get(MCP_REFRESH_TOKEN_HASH_KEY) or "").strip()
        if not token_hash:
            return
        expires_at = doc.get("expiresAt")
        ttl_seconds = MCP_REFRESH_TOKEN_TTL_SECONDS
        if expires_at:
            try:
                ttl_seconds = max(1, int((expires_at - utc_now()).total_seconds()))
            except Exception:
                ttl_seconds = MCP_REFRESH_TOKEN_TTL_SECONDS
        try:
            client.setex(
                self._refresh_cache_key(token_hash),
                ttl_seconds,
                pickle.dumps(doc),
            )
        except Exception:
            logger.exception("MCP refresh token cache write failed for token_hash=%s", token_hash)

    def _delete_cached_refresh_doc(self, token_hash: str | None, client: Redis | None = None) -> None:
        if not token_hash:
            return
        client = client or self._redis()
        if not client:
            return
        try:
            client.delete(self._refresh_cache_key(token_hash))
        except Exception:
            logger.exception("MCP refresh token cache delete failed for token_hash=%s", token_hash)

    def _read_refresh_doc_by_hash(self, token_hash: str, client: Redis | None = None) -> dict | None:
        cached = self._read_cached_refresh_doc(token_hash, client=client)
        if cached:
            return cached
        matches = firestore_store.find_by_fields(MCP_REFRESH_TOKENS_COLLECTION, {MCP_REFRESH_TOKEN_HASH_KEY: token_hash})
        doc = matches[0] if matches else None
        if doc:
            self._write_cached_refresh_doc(doc, client=client)
        return doc

    def create_access_token(
        self,
        *,
        user_id: str,
        project_id: str,
        workspace_id: str | None = None,
        label: str | None = None,
        client_id: str | None = None,
        scopes: list[str] | None = None,
    ) -> dict:
        raw_token = f"mcp_{uuid4().hex}{uuid4().hex}"
        token_id = str(uuid4())
        now = utc_now()
        expires_at = now + timedelta(seconds=MCP_TOKEN_TTL_SECONDS)
        doc = {
            MCP_TOKEN_ID_KEY: token_id,
            MCP_TOKEN_HASH_KEY: self.hash_token(raw_token),
            "userId": user_id,
            "projectId": project_id,
            "workspaceId": workspace_id or str(uuid4()),
            "clientId": client_id,
            "scopes": list(scopes or ["mcp"]),
            "createdAt": now,
            "expiresAt": expires_at,
            "revoked": False,
            "label": (label or "").strip() or None,
            "usage": 0,
            "limitPerMonth": MCP_TOKEN_LIMIT_PER_MONTH,
        }
        firestore_store.create(MCP_TOKENS_COLLECTION, doc, doc_id=token_id)
        self._write_cached_doc(doc)
        public_doc = dict(doc)
        public_doc["rawToken"] = raw_token
        return public_doc

    def create_refresh_token(
        self,
        *,
        user_id: str,
        project_id: str,
        workspace_id: str,
        client_id: str,
        scopes: list[str],
        label: str | None = None,
    ) -> dict:
        raw_token = f"mcp_refresh_{uuid4().hex}{uuid4().hex}"
        refresh_token_id = str(uuid4())
        now = utc_now()
        expires_at = now + timedelta(seconds=MCP_REFRESH_TOKEN_TTL_SECONDS)
        doc = {
            MCP_REFRESH_TOKEN_ID_KEY: refresh_token_id,
            MCP_REFRESH_TOKEN_HASH_KEY: self.hash_token(raw_token),
            "userId": user_id,
            "projectId": project_id,
            "workspaceId": workspace_id,
            "clientId": client_id,
            "scopes": list(scopes or ["mcp"]),
            "createdAt": now,
            "expiresAt": expires_at,
            "revoked": False,
            "label": (label or "").strip() or None,
        }
        firestore_store.create(MCP_REFRESH_TOKENS_COLLECTION, doc, doc_id=refresh_token_id)
        self._write_cached_refresh_doc(doc)
        public_doc = dict(doc)
        public_doc["rawToken"] = raw_token
        return public_doc

    def get_by_id(self, token_id: str) -> dict | None:
        return firestore_store.get(MCP_TOKENS_COLLECTION, token_id)

    def _is_doc_active(self, doc: dict | None) -> bool:
        if not doc:
            return False
        if bool(doc.get("revoked")):
            return False
        expires_at = doc.get("expiresAt")
        if expires_at and expires_at <= utc_now():
            return False
        usage = int(doc.get("usage", 0))
        limit = int(doc.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH))
        return usage < limit

    def resolve_token_doc(self, raw_token: str) -> dict | None:
        token_hash = self.hash_token(raw_token)
        client = self._redis()
        doc = self._read_doc_by_hash(token_hash, client=client)
        if not self._is_doc_active(doc):
            return None
        return doc

    def load_access_token(self, raw_token: str) -> AccessToken | None:
        doc = self.resolve_token_doc(raw_token)
        if not doc:
            return None
        expires_at = doc.get("expiresAt")
        expires_unix = None
        if expires_at:
            try:
                expires_unix = int(expires_at.timestamp())
            except Exception:
                expires_unix = None
        return AccessToken(
            token=raw_token,
            client_id=str(doc.get("clientId") or "whitepapper"),
            scopes=[str(item) for item in doc.get("scopes") or ["mcp"]],
            expires_at=expires_unix,
            resource=None,
        )

    def load_refresh_token(self, raw_token: str) -> dict | None:
        token_hash = self.hash_token(raw_token)
        client = self._redis()
        doc = self._read_refresh_doc_by_hash(token_hash, client=client)
        if not doc:
            return None
        if bool(doc.get("revoked")):
            return None
        expires_at = doc.get("expiresAt")
        if expires_at and expires_at <= utc_now():
            return None
        return doc

    def revoke_mcp_token(self, token_id: str) -> None:
        current = firestore_store.get(MCP_TOKENS_COLLECTION, token_id)
        if not current:
            return
        current["revoked"] = True
        firestore_store.update(MCP_TOKENS_COLLECTION, token_id, {"revoked": True})
        self._delete_cached_doc(current.get(MCP_TOKEN_HASH_KEY))

    def revoke_refresh_token(self, refresh_token_id: str) -> None:
        current = firestore_store.get(MCP_REFRESH_TOKENS_COLLECTION, refresh_token_id)
        if not current:
            return
        firestore_store.update(MCP_REFRESH_TOKENS_COLLECTION, refresh_token_id, {"revoked": True})
        self._delete_cached_refresh_doc(current.get(MCP_REFRESH_TOKEN_HASH_KEY))

    def revoke_refresh_token_doc(self, refresh_doc: dict | None) -> None:
        if not refresh_doc:
            return
        refresh_token_id = str(refresh_doc.get(MCP_REFRESH_TOKEN_ID_KEY) or "").strip()
        if refresh_token_id:
            self.revoke_refresh_token(refresh_token_id)

    def increment_usage(self, token_hash: str | None) -> None:
        if not token_hash:
            return
        client = self._redis()
        if not client:
            return
        doc = self._read_cached_doc(token_hash, client=client)
        if not doc:
            return
        doc["usage"] = int(doc.get("usage", 0)) + 1
        self._write_cached_doc(doc, client=client)

    def increment_usage_for_raw_token(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        self.increment_usage(self.hash_token(raw_token))

    def list_mcp_tokens_for_user(self, user_id: str) -> list[dict]:
        matches = firestore_store.find_by_fields(MCP_TOKENS_COLLECTION, {"userId": user_id})
        items: list[dict] = []
        now = utc_now()
        for item in matches:
            if bool(item.get("revoked")):
                continue
            expires_at = item.get("expiresAt")
            if expires_at and expires_at <= now:
                continue
            items.append(
                {
                    "tokenId": item.get("tokenId"),
                    "projectId": item.get("projectId"),
                    "workspaceId": item.get("workspaceId"),
                    "label": item.get("label"),
                    "createdAt": item.get("createdAt"),
                    "expiresAt": item.get("expiresAt"),
                    "usage": int(item.get("usage", 0)),
                    "limitPerMonth": int(item.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH)),
                }
            )
        items.sort(key=lambda item: str(item.get("createdAt") or ""), reverse=True)
        return items

    def sync_cache_with_firestore(self) -> int:
        client = self._redis()
        if not client:
            return 0
        synced = 0
        pattern = f"{get_cache_prefix()}:mcp_tokens:*"
        for key in client.scan_iter(match=pattern):
            try:
                payload = client.get(key)
                if payload is None:
                    continue
                cached_doc = pickle.loads(payload)
                if not isinstance(cached_doc, dict):
                    continue
            except Exception:
                logger.exception("MCP token cache read failed for key=%s", key)
                continue
            token_id = str(cached_doc.get(MCP_TOKEN_ID_KEY) or "").strip()
            if not token_id:
                continue
            try:
                firestore_store.update(
                    MCP_TOKENS_COLLECTION,
                    token_id,
                    {"usage": int(cached_doc.get("usage", 0))},
                )
            except Exception:
                logger.exception("MCP token firestore sync failed for token_id=%s", token_id)
                continue
            synced += 1
        return synced

    def reset_all_usage(self) -> int:
        all_tokens = firestore_store.list_all(MCP_TOKENS_COLLECTION)
        token_ids: list[str] = []
        for token in all_tokens:
            token_id = str(token.get(MCP_TOKEN_ID_KEY) or "").strip()
            if not token_id:
                continue
            firestore_store.update(MCP_TOKENS_COLLECTION, token_id, {"usage": 0})
            token_ids.append(token_id)

        client = self._redis()
        if client:
            pattern = f"{get_cache_prefix()}:mcp_tokens:*"
            try:
                keys = list(client.scan_iter(match=pattern))
                if keys:
                    client.delete(*keys)
            except Exception:
                logger.exception("MCP token cache reset failed.")
        return len(token_ids)


mcp_token_service = McpTokenService()


def generate_mcp_token(user_id: str, project_id: str) -> str:
    created = mcp_token_service.create_access_token(user_id=user_id, project_id=project_id)
    return str(created["rawToken"])


def resolve_mcp_token(plain_token: str) -> dict | None:
    doc = mcp_token_service.resolve_token_doc(plain_token)
    if not doc:
        return None
    return {
        "user_id": doc.get("userId"),
        "project_id": doc.get("projectId"),
        "workspace_id": doc.get("workspaceId"),
    }


def revoke_mcp_token(token_id: str) -> None:
    mcp_token_service.revoke_mcp_token(token_id)


def list_mcp_tokens_for_user(user_id: str) -> list[dict]:
    return mcp_token_service.list_mcp_tokens_for_user(user_id)
