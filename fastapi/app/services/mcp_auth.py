from __future__ import annotations

import hashlib
from datetime import timezone
from typing import Any

from app.core.firestore_store import firestore_store, utc_now
from app.core.limits import MCP_TOKEN_LIMIT_PER_MONTH

MCP_AUTHORIZATIONS_COLLECTION = "mcp_authorizations"
MCP_USER_USAGE_COLLECTION = "mcp_user_monthly_usage"
MCP_REVOKED_TOKENS_COLLECTION = "mcp_revoked_tokens"
LEGACY_MCP_TOKENS_COLLECTION = "mcp_tokens"
LEGACY_MCP_PROJECT_USAGE_COLLECTION = "mcp_project_monthly_usage"


def _month_key() -> str:
    return utc_now().astimezone(timezone.utc).strftime("%Y-%m")


def _authorization_id(user_id: str, client_id: str) -> str:
    digest = hashlib.sha256(f"{user_id}:{client_id}".encode("utf-8")).hexdigest()
    return f"mcpauth_{digest}"


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _usage_doc_id(user_id: str, month: str | None = None) -> str:
    return f"{user_id}:{(month or _month_key()).strip()}"


class McpAuthorizationService:
    @staticmethod
    def authorization_id(user_id: str, client_id: str) -> str:
        return _authorization_id(user_id, client_id)

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hash_token(raw_token)

    def _get_usage_doc(self, user_id: str, month: str | None = None) -> dict[str, Any]:
        resolved_month = (month or _month_key()).strip()
        doc_id = _usage_doc_id(user_id, resolved_month)
        existing = firestore_store.get(MCP_USER_USAGE_COLLECTION, doc_id)
        if existing:
            return existing

        now = utc_now()
        created = {
            "usageId": doc_id,
            "userId": user_id,
            "month": resolved_month,
            "usage": 0,
            "limitPerMonth": MCP_TOKEN_LIMIT_PER_MONTH,
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(MCP_USER_USAGE_COLLECTION, created, doc_id=doc_id)
        return created

    def get_user_month_usage(self, user_id: str) -> dict[str, Any]:
        return self._get_usage_doc(user_id)

    def is_user_usage_within_limit(self, user_id: str) -> bool:
        usage_doc = self._get_usage_doc(user_id)
        usage = int(usage_doc.get("usage", 0))
        limit = int(usage_doc.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH))
        return usage < limit

    def increment_user_usage(self, user_id: str) -> int:
        usage_doc = self._get_usage_doc(user_id)
        doc_id = str(usage_doc.get("usageId") or _usage_doc_id(user_id))
        firestore_store.update(
            MCP_USER_USAGE_COLLECTION,
            doc_id,
            {"updatedAt": utc_now()},
        )
        firestore_store.increment(MCP_USER_USAGE_COLLECTION, doc_id, "usage", 1)
        refreshed = firestore_store.get(MCP_USER_USAGE_COLLECTION, doc_id) or usage_doc
        return int(refreshed.get("usage", 0))

    def get_authorization(self, user_id: str, client_id: str) -> dict[str, Any] | None:
        if not user_id or not client_id:
            return None
        return firestore_store.get(MCP_AUTHORIZATIONS_COLLECTION, _authorization_id(user_id, client_id))

    def get_revoked_token(self, authorization_id: str) -> dict[str, Any] | None:
        if not authorization_id:
            return None
        return firestore_store.get(MCP_REVOKED_TOKENS_COLLECTION, authorization_id)

    def is_token_revoked(self, authorization_id: str, token_hash: str) -> bool:
        if not authorization_id or not token_hash:
            return False
        revoked = self.get_revoked_token(authorization_id)
        return str((revoked or {}).get("tokenHash") or "") == token_hash

    def clear_token_revocation(self, authorization_id: str) -> None:
        if not authorization_id:
            return
        firestore_store.delete(MCP_REVOKED_TOKENS_COLLECTION, authorization_id)

    def upsert_authorization(
        self,
        *,
        user_id: str,
        client_id: str,
        agent_name: str | None = None,
        scopes: list[str] | None = None,
        token_hash: str | None = None,
    ) -> dict[str, Any]:
        authorization_id = _authorization_id(user_id, client_id)
        current = firestore_store.get(MCP_AUTHORIZATIONS_COLLECTION, authorization_id)
        now = utc_now()

        payload = {
            "authorizationId": authorization_id,
            "userId": user_id,
            "clientId": client_id,
            "agentName": (agent_name or "").strip() or None,
            "scopes": list(scopes or []),
            "lastTokenHash": str(token_hash or "").strip() or None,
            "lastActive": now,
            "updatedAt": now,
        }
        self.clear_token_revocation(authorization_id)
        if current:
            firestore_store.update(MCP_AUTHORIZATIONS_COLLECTION, authorization_id, payload)
            current.update(payload)
            return current

        created = {
            **payload,
            "createdAt": now,
        }
        firestore_store.create(MCP_AUTHORIZATIONS_COLLECTION, created, doc_id=authorization_id)
        return created

    def list_authorizations_for_user(self, user_id: str) -> list[dict[str, Any]]:
        authorizations = firestore_store.find_by_fields(MCP_AUTHORIZATIONS_COLLECTION, {"userId": user_id})
        authorizations.sort(
            key=lambda item: str(item.get("lastActive") or item.get("createdAt") or ""),
            reverse=True,
        )
        return authorizations

    def revoke_authorization(self, user_id: str, authorization_id: str) -> bool:
        current = firestore_store.get(MCP_AUTHORIZATIONS_COLLECTION, authorization_id)
        if not current:
            return False
        if str(current.get("userId") or "") != user_id:
            return False
        token_hash = str(current.get("lastTokenHash") or "").strip()
        if token_hash:
            firestore_store.create(
                MCP_REVOKED_TOKENS_COLLECTION,
                {
                    "authorizationId": authorization_id,
                    "userId": user_id,
                    "clientId": str(current.get("clientId") or ""),
                    "tokenHash": token_hash,
                    "revokedAt": utc_now(),
                },
                doc_id=authorization_id,
            )
        firestore_store.delete(MCP_AUTHORIZATIONS_COLLECTION, authorization_id)
        return True

    def revoke_authorization_by_client(self, user_id: str, client_id: str) -> bool:
        return self.revoke_authorization(user_id, _authorization_id(user_id, client_id))

    def reset_all_usage(self) -> int:
        current_month = _month_key()
        removed = 0

        usage_docs = firestore_store.list_all(MCP_USER_USAGE_COLLECTION)
        for usage_doc in usage_docs:
            month = str(usage_doc.get("month") or "").strip()
            doc_id = str(usage_doc.get("usageId") or "").strip()
            if not doc_id or month == current_month:
                continue
            firestore_store.delete(MCP_USER_USAGE_COLLECTION, doc_id)
            removed += 1

        legacy_tokens = firestore_store.list_all(LEGACY_MCP_TOKENS_COLLECTION)
        for token_doc in legacy_tokens:
            token_id = str(token_doc.get("tokenId") or token_doc.get("usageId") or "").strip()
            if not token_id:
                continue
            firestore_store.delete(LEGACY_MCP_TOKENS_COLLECTION, token_id)
            removed += 1

        legacy_usage = firestore_store.list_all(LEGACY_MCP_PROJECT_USAGE_COLLECTION)
        for usage_doc in legacy_usage:
            doc_id = str(usage_doc.get("usageId") or "").strip()
            project_id = str(usage_doc.get("projectId") or "").strip()
            month = str(usage_doc.get("month") or "").strip()
            resolved_id = doc_id or (f"{project_id}:{month}" if project_id and month else "")
            if not resolved_id:
                continue
            firestore_store.delete(LEGACY_MCP_PROJECT_USAGE_COLLECTION, resolved_id)
            removed += 1

        return removed


mcp_authorization_service = McpAuthorizationService()
