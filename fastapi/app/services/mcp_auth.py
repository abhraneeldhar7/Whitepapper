from __future__ import annotations

import hashlib
import secrets
from typing import Any
from uuid import uuid4

from app.core.firestore_store import firestore_store
from app.core.limits import MCP_TOKEN_LIMIT_PER_MONTH
from app.utils.datetime import utc_now

MCP_TOKENS_COLLECTION = "mcp_tokens"
MCP_USAGE_COLLECTION = "mcp_usage"
MCP_CLIENTS_COLLECTION = "mcp_clients"
MCP_TOKEN_PREFIX = "wpmcp_"


def _normalize_hash(raw_token: str) -> str:
    digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


class McpAuthorizationService:
    @staticmethod
    def hash_token(raw_token: str) -> str:
        return _normalize_hash(raw_token)

    def issue_token(self, *, user_id: str, agent_name: str | None = None, client_id: str | None = None) -> tuple[str, dict[str, Any]]:
        raw_token = f"{MCP_TOKEN_PREFIX}{secrets.token_urlsafe(32)}"
        token_id = str(uuid4())

        if client_id:
            for existing in self.list_tokens_for_user(user_id):
                if str(existing.get("clientId") or "") == client_id:
                    self.revoke_token(user_id, str(existing.get("tokenId") or ""))

        token_doc = {
            "key_hash": self.hash_token(raw_token),
            "userId": user_id,
            "agentName": (agent_name or "").strip() or None,
            "clientId": client_id,
            "created_at": utc_now(),
        }
        firestore_store.create(MCP_TOKENS_COLLECTION, token_doc, doc_id=token_id)
        return raw_token, {"tokenId": token_id, **token_doc}

    def get_token_by_hash(self, token_hash: str) -> dict[str, Any] | None:
        matches = firestore_store.find_by_fields_with_ids(MCP_TOKENS_COLLECTION, {"key_hash": token_hash})
        if not matches:
            return None
        token_doc = matches[0]
        return {"tokenId": str(token_doc.get("_id") or ""), **{k: v for k, v in token_doc.items() if k != "_id"}}

    def get_token(self, token_id: str) -> dict[str, Any] | None:
        if not token_id:
            return None
        token_doc = firestore_store.get(MCP_TOKENS_COLLECTION, token_id)
        if token_doc is None:
            return None
        return {"tokenId": token_id, **token_doc}

    def list_tokens_for_user(self, user_id: str) -> list[dict[str, Any]]:
        tokens: list[dict[str, Any]] = []
        for item in firestore_store.list_all_with_ids(MCP_TOKENS_COLLECTION):
            if str(item.get("userId") or "") != user_id:
                continue
            token_id = str(item.get("_id") or "").strip()
            tokens.append({"tokenId": token_id, **{k: v for k, v in item.items() if k != "_id"}})
        tokens.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
        return tokens

    @staticmethod
    def get_agent_name_by_client_id(client_id: str) -> str | None:
        client_doc = firestore_store.get(MCP_CLIENTS_COLLECTION, client_id)
        if client_doc:
            name = str(client_doc.get("clientName") or "").strip()
            if name:
                return name
        for item in firestore_store.find_by_fields_with_ids(MCP_TOKENS_COLLECTION, {"clientId": client_id}):
            name = str(item.get("agentName") or "").strip()
            if name:
                return name
        return None

    def set_client_name(self, client_id: str, client_name: str) -> None:
        firestore_store.create(MCP_CLIENTS_COLLECTION, {"clientName": client_name}, doc_id=client_id)

    def revoke_token(self, user_id: str, token_id: str) -> bool:
        token_doc = self.get_token(token_id)
        if token_doc is None:
            return False
        if str(token_doc.get("userId") or "") != user_id:
            return False
        firestore_store.delete(MCP_TOKENS_COLLECTION, token_id)
        return True

    def get_user_usage(self, user_id: str) -> dict[str, Any]:
        usage_doc = firestore_store.get(MCP_USAGE_COLLECTION, user_id)
        if usage_doc is not None:
            return usage_doc

        created = {
            "usage": 0,
            "limitPerMonth": MCP_TOKEN_LIMIT_PER_MONTH,
        }
        firestore_store.create(MCP_USAGE_COLLECTION, created, doc_id=user_id)
        return created

    def is_user_usage_within_limit(self, user_id: str) -> bool:
        usage_doc = self.get_user_usage(user_id)
        usage = int(usage_doc.get("usage", 0))
        limit = int(usage_doc.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH))
        return usage < limit

    def increment_user_usage(self, user_id: str) -> int:
        self.get_user_usage(user_id)
        firestore_store.increment(MCP_USAGE_COLLECTION, user_id, "usage", 1)
        usage_doc = firestore_store.get(MCP_USAGE_COLLECTION, user_id) or {"usage": 0}
        return int(usage_doc.get("usage", 0))

    def reset_all_usage(self) -> int:
        removed = 0
        for usage_doc in firestore_store.list_all_with_ids(MCP_USAGE_COLLECTION):
            doc_id = str(usage_doc.get("_id") or "").strip()
            if not doc_id:
                continue
            firestore_store.delete(MCP_USAGE_COLLECTION, doc_id)
            removed += 1
        return removed

    def delete_user_data(self, user_id: str) -> dict[str, int]:
        deleted_tokens = 0
        for token in self.list_tokens_for_user(user_id):
            token_id = str(token.get("tokenId") or "").strip()
            if not token_id:
                continue
            firestore_store.delete(MCP_TOKENS_COLLECTION, token_id)
            deleted_tokens += 1

        deleted_usage_docs = 0
        if firestore_store.get(MCP_USAGE_COLLECTION, user_id) is not None:
            firestore_store.delete(MCP_USAGE_COLLECTION, user_id)
            deleted_usage_docs = 1

        return {
            "mcpTokens": deleted_tokens,
            "mcpUsageDocs": deleted_usage_docs,
        }


mcp_authorization_service = McpAuthorizationService()
