from __future__ import annotations

import hashlib
import logging
import pickle
from datetime import timezone
from uuid import uuid4

from mcp.server.auth.provider import AccessToken
from redis import Redis

from app.core.firestore_store import firestore_store, utc_now
from app.core.limits import MCP_TOKEN_LIMIT_PER_MONTH
from app.core.redis_client import get_cache_prefix, get_redis_client

logger = logging.getLogger(__name__)

MCP_TOKENS_COLLECTION = "mcp_tokens"
MCP_PROJECT_MONTHLY_USAGE_COLLECTION = "mcp_project_monthly_usage"
MCP_TOKEN_ID_KEY = "tokenId"
MCP_TOKEN_HASH_KEY = "tokenHash"
MCP_TOKEN_CACHE_TTL_SECONDS = 60 * 60


class McpTokenService:
    @staticmethod
    def _current_month_key() -> str:
        return utc_now().astimezone(timezone.utc).strftime("%Y-%m")

    @staticmethod
    def _project_month_usage_doc_id(project_id: str, month_key: str | None = None) -> str:
        resolved_month = (month_key or McpTokenService._current_month_key()).strip()
        return f"{project_id}:{resolved_month}"

    def _get_project_month_usage_doc(self, project_id: str, month_key: str | None = None) -> dict:
        resolved_month = (month_key or self._current_month_key()).strip()
        doc_id = self._project_month_usage_doc_id(project_id, resolved_month)
        existing = firestore_store.get(MCP_PROJECT_MONTHLY_USAGE_COLLECTION, doc_id)
        if existing:
            return existing

        now = utc_now()
        doc = {
            "usageId": doc_id,
            "projectId": project_id,
            "month": resolved_month,
            "usage": 0,
            "limitPerMonth": MCP_TOKEN_LIMIT_PER_MONTH,
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(MCP_PROJECT_MONTHLY_USAGE_COLLECTION, doc, doc_id=doc_id)
        return doc

    def _increment_project_month_usage(self, project_id: str) -> int:
        doc = self._get_project_month_usage_doc(project_id)
        doc_id = self._project_month_usage_doc_id(project_id)
        # Ensure document exists before atomic increment.
        firestore_store.update(
            MCP_PROJECT_MONTHLY_USAGE_COLLECTION,
            doc_id,
            {"updatedAt": utc_now()},
        )
        firestore_store.increment(MCP_PROJECT_MONTHLY_USAGE_COLLECTION, doc_id, "usage", 1)
        refreshed = firestore_store.get(MCP_PROJECT_MONTHLY_USAGE_COLLECTION, doc_id) or doc
        return int(refreshed.get("usage", 0))

    def _is_project_usage_within_limit(self, project_id: str) -> bool:
        usage_doc = self._get_project_month_usage_doc(project_id)
        usage = int(usage_doc.get("usage", 0))
        limit = int(usage_doc.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH))
        return usage < limit

    def get_project_month_usage(self, project_id: str) -> dict:
        return self._get_project_month_usage_doc(project_id)

    def _redis(self) -> Redis | None:
        return get_redis_client()

    def _doc_cache_key(self, token_hash: str) -> str:
        return f"{get_cache_prefix()}:mcp_tokens:{token_hash}"

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
        try:
            client.setex(
                self._doc_cache_key(token_hash),
                MCP_TOKEN_CACHE_TTL_SECONDS,
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
        doc = {
            MCP_TOKEN_ID_KEY: token_id,
            MCP_TOKEN_HASH_KEY: self.hash_token(raw_token),
            "userId": user_id,
            "projectId": project_id,
            "workspaceId": workspace_id or str(uuid4()),
            "clientId": client_id,
            "scopes": list(scopes or ["mcp"]),
            "createdAt": now,
            "revoked": False,
            "label": (label or "").strip() or None,
        }
        firestore_store.create(MCP_TOKENS_COLLECTION, doc, doc_id=token_id)
        self._write_cached_doc(doc)
        # Ensure the per-project monthly usage document exists.
        self._get_project_month_usage_doc(project_id)
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
        project_id = str(doc.get("projectId") or "").strip()
        if not project_id:
            return False
        return self._is_project_usage_within_limit(project_id)

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
        return AccessToken(
            token=raw_token,
            client_id=str(doc.get("clientId") or "whitepapper"),
            scopes=[str(item) for item in doc.get("scopes") or ["mcp"]],
            expires_at=None,
            resource=None,
        )

    def revoke_mcp_token(self, token_id: str) -> None:
        current = firestore_store.get(MCP_TOKENS_COLLECTION, token_id)
        if not current:
            return
        firestore_store.update(MCP_TOKENS_COLLECTION, token_id, {"revoked": True})
        self._delete_cached_doc(current.get(MCP_TOKEN_HASH_KEY))

    def increment_usage_for_raw_token(self, raw_token: str | None) -> None:
        if not raw_token:
            return

        token_hash = self.hash_token(raw_token)
        client = self._redis()
        doc = self._read_doc_by_hash(token_hash, client=client)
        if not doc:
            return

        token_id = str(doc.get(MCP_TOKEN_ID_KEY) or "").strip()
        if not token_id:
            return

        project_id = str(doc.get("projectId") or "").strip()
        if not project_id:
            return

        self._increment_project_month_usage(project_id)
        self._write_cached_doc(doc, client=client)

    def list_mcp_tokens_for_user(self, user_id: str) -> list[dict]:
        matches = firestore_store.find_by_fields(MCP_TOKENS_COLLECTION, {"userId": user_id})
        project_usage_map: dict[str, dict] = {}
        items: list[dict] = []
        for item in matches:
            if bool(item.get("revoked")):
                continue
            project_id = str(item.get("projectId") or "")
            if project_id and project_id not in project_usage_map:
                project_usage_map[project_id] = self._get_project_month_usage_doc(project_id)
            usage_doc = project_usage_map.get(project_id, {})
            items.append(
                {
                    "tokenId": item.get("tokenId"),
                    "projectId": project_id,
                    "workspaceId": item.get("workspaceId"),
                    "label": item.get("label"),
                    "createdAt": item.get("createdAt"),
                    "usage": int(usage_doc.get("usage", 0)),
                    "limitPerMonth": int(usage_doc.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH)),
                }
            )
        items.sort(key=lambda item: str(item.get("createdAt") or ""), reverse=True)
        return items

    def sync_cache_with_firestore(self) -> int:
        # Token cache only stores immutable auth context now; usage is tracked in
        # project-month documents directly in Firestore.
        return 0

    def reset_all_usage(self) -> int:
        # Monthly usage naturally rolls over by month key. This maintenance step
        # only cleans up historical usage docs from past months.
        current_month = self._current_month_key()
        usage_docs = firestore_store.list_all(MCP_PROJECT_MONTHLY_USAGE_COLLECTION)
        removed = 0
        for usage_doc in usage_docs:
            month = str(usage_doc.get("month") or "").strip()
            usage_id = str(usage_doc.get("usageId") or "").strip()
            project_id = str(usage_doc.get("projectId") or "").strip()
            doc_id = usage_id or (f"{project_id}:{month}" if project_id and month else "")
            if not doc_id or month == current_month:
                continue
            firestore_store.delete(MCP_PROJECT_MONTHLY_USAGE_COLLECTION, doc_id)
            removed += 1
        return removed


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
