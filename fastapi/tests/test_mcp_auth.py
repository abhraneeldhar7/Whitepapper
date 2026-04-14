from __future__ import annotations

import pickle
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from app.utils import mcp_auth


class FakeRedis:
    def __init__(self) -> None:
        self.data: dict[str, bytes] = {}

    def get(self, key: str):
        return self.data.get(key)

    def setex(self, key: str, _ttl: int, value: bytes) -> None:
        self.data[key] = value

    def delete(self, *keys: str) -> None:
        for key in keys:
            self.data.pop(key, None)

    def scan_iter(self, match: str | None = None):
        prefix = (match or "").rstrip("*")
        for key in list(self.data.keys()):
            if not prefix or key.startswith(prefix):
                yield key


class FakeStore:
    def __init__(self) -> None:
        self.docs: dict[str, dict[str, dict]] = {}

    def create(self, collection: str, payload: dict, doc_id: str | None = None):
        if collection not in self.docs:
            self.docs[collection] = {}
        if doc_id is None:
            raise AssertionError("doc_id is required in this fake store")
        self.docs[collection][doc_id] = dict(payload)
        return payload

    def get(self, collection: str, doc_id: str):
        return dict(self.docs.get(collection, {}).get(doc_id) or {}) or None

    def update(self, collection: str, doc_id: str, payload: dict, merge: bool = True):
        current = dict(self.docs.get(collection, {}).get(doc_id) or {})
        next_doc = {**current, **payload} if merge else dict(payload)
        self.docs.setdefault(collection, {})[doc_id] = next_doc
        return next_doc

    def find_by_fields(self, collection: str, filters: dict):
        matches = []
        for item in self.docs.get(collection, {}).values():
            if all(item.get(key) == value for key, value in filters.items()):
                matches.append(dict(item))
        return matches

    def list_all(self, collection: str):
        return [dict(item) for item in self.docs.get(collection, {}).values()]


class McpAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = FakeStore()
        self.redis = FakeRedis()
        self.fixed_now = datetime(2026, 4, 12, 12, 0, 0, tzinfo=timezone.utc)

        self.patches = [
            patch.object(mcp_auth, "firestore_store", self.store),
            patch.object(mcp_auth, "get_redis_client", return_value=self.redis),
            patch.object(mcp_auth, "utc_now", side_effect=lambda: self.fixed_now),
        ]
        for item in self.patches:
            item.start()

    def tearDown(self) -> None:
        for item in reversed(self.patches):
            item.stop()

    def test_generate_mcp_token_stores_only_hash_and_resolves(self) -> None:
        raw_token = mcp_auth.generate_mcp_token("user_123", "project_456")

        stored = self.store.list_all(mcp_auth.MCP_TOKENS_COLLECTION)
        self.assertEqual(len(stored), 1)
        token_doc = stored[0]
        self.assertTrue(raw_token.startswith("mcp_"))
        self.assertNotIn("rawToken", token_doc)
        self.assertEqual(token_doc["tokenHash"], mcp_auth.mcp_token_service.hash_token(raw_token))
        self.assertNotEqual(token_doc["tokenHash"], raw_token)

        resolved = mcp_auth.resolve_mcp_token(raw_token)
        self.assertEqual(
            resolved,
            {
                "user_id": "user_123",
                "project_id": "project_456",
                "workspace_id": token_doc["workspaceId"],
            },
        )

        cache_key = mcp_auth.mcp_token_service._doc_cache_key(token_doc["tokenHash"])
        self.assertIn(cache_key, self.redis.data)
        cached = pickle.loads(self.redis.data[cache_key])
        self.assertEqual(cached["tokenHash"], token_doc["tokenHash"])

    def test_resolve_mcp_token_returns_none_when_revoked_or_expired(self) -> None:
        raw_token = mcp_auth.generate_mcp_token("user_123", "project_456")
        token_doc = self.store.list_all(mcp_auth.MCP_TOKENS_COLLECTION)[0]

        self.store.update(
            mcp_auth.MCP_TOKENS_COLLECTION,
            token_doc["tokenId"],
            {"revoked": True},
        )
        self.redis.delete(mcp_auth.mcp_token_service._doc_cache_key(token_doc["tokenHash"]))
        self.assertIsNone(mcp_auth.resolve_mcp_token(raw_token))

        self.store.update(
            mcp_auth.MCP_TOKENS_COLLECTION,
            token_doc["tokenId"],
            {"revoked": False, "expiresAt": datetime(2026, 4, 11, 12, 0, 0, tzinfo=timezone.utc)},
        )
        self.redis.delete(mcp_auth.mcp_token_service._doc_cache_key(token_doc["tokenHash"]))
        self.assertIsNone(mcp_auth.resolve_mcp_token(raw_token))


if __name__ == "__main__":
    unittest.main()
