from __future__ import annotations

import base64
import json
from typing import Any
from uuid import uuid4

from firebase_admin import firestore

from app.core.firebase_admin import get_firestore_client


class FirestoreStore:
    DOCUMENT_ID_FIELD = "__name__"

    def __init__(self) -> None:
        self.db = None

    def _collection(self, name: str):
        if self.db is None:
            self.db = get_firestore_client()
        return self.db.collection(name)

    def get(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        snap = self._collection(collection).document(doc_id).get()
        if not snap.exists:
            return None
        data = snap.to_dict()
        return data

    def create(self, collection: str, payload: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
        doc_id = doc_id or str(uuid4())
        self._collection(collection).document(doc_id).set(payload)
        return payload

    def update(self, collection: str, doc_id: str, payload: dict[str, Any], merge: bool = True) -> dict[str, Any]:
        self._collection(collection).document(doc_id).set(payload, merge=merge)
        return payload

    def increment(self, collection: str, doc_id: str, field: str, amount: int = 1) -> None:
        self._collection(collection).document(doc_id).update({field: firestore.Increment(amount)})

    def delete(self, collection: str, doc_id: str) -> None:
        self._collection(collection).document(doc_id).delete()

    @staticmethod
    def _direction_value(direction: str):
        normalized = str(direction or "ASCENDING").strip().upper()
        if normalized not in {"ASCENDING", "DESCENDING"}:
            raise ValueError("direction must be ASCENDING or DESCENDING.")
        return firestore.Query.ASCENDING if normalized == "ASCENDING" else firestore.Query.DESCENDING

    @classmethod
    def _field_path(cls, field: str):
        return firestore.FieldPath.document_id() if field == cls.DOCUMENT_ID_FIELD else field

    # NOTE: This list-based cursor is intentionally different from pagination.py's
    # offset-based cursor. This firestore_store cursor is designed for Firestore document
    # pagination with start_after semantics (list of field values). The pagination module
    # uses a simple offset for REST endpoints. Both formats are incompatible by design —
    # do not attempt to merge them.

    @staticmethod
    def _encode_cursor(values: list[Any]) -> str:
        payload = json.dumps(values, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
        return base64.urlsafe_b64encode(payload).decode("ascii")

    @staticmethod
    def _decode_cursor(cursor: str | None) -> list[Any] | None:
        raw_value = str(cursor or "").strip()
        if not raw_value:
            return None
        try:
            decoded = base64.urlsafe_b64decode(raw_value.encode("ascii")).decode("utf-8")
            values = json.loads(decoded)
        except Exception as exc:
            raise ValueError("Invalid cursor.") from exc
        if not isinstance(values, list):
            raise ValueError("Invalid cursor.")
        return values

    def _apply_filters(self, collection: str, filters: dict[str, Any] | None = None):
        query = self._collection(collection)
        for field, value in (filters or {}).items():
            query = query.where(filter=firestore.FieldFilter(field, "==", value))
        return query

    def get_many(self, collection: str, doc_ids: list[str]) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        seen: set[str] = set()
        for doc_id in doc_ids:
            normalized = str(doc_id or "").strip()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            doc = self.get(collection, normalized)
            if doc is not None:
                items.append(doc)
        return items

    def find_by_fields(
        self,
        collection: str,
        filters: dict[str, Any],
        *,
        order_by: list[tuple[str, str]] | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        paginate: bool = False,
    ) -> list[dict[str, Any]] | dict[str, Any]:
        query = self._apply_filters(collection, filters)
        normalized_order = order_by or []
        for field, direction in normalized_order:
            query = query.order_by(self._field_path(field), direction=self._direction_value(direction))

        if not paginate:
            return [snap.to_dict() for snap in query.stream()]

        normalized_limit = max(1, min(int(limit or 25), 100))
        cursor_values = self._decode_cursor(cursor)
        if cursor_values is not None:
            if normalized_order:
                query = query.start_after(cursor_values)
            else:
                last_doc_id = str(cursor_values[0] or "").strip() if cursor_values else ""
                if not last_doc_id:
                    raise ValueError("Invalid cursor.")
                last_snapshot = self._collection(collection).document(last_doc_id).get()
                if not last_snapshot.exists:
                    raise ValueError("Invalid cursor.")
                query = query.start_after(last_snapshot)

        snapshots = list(query.limit(normalized_limit + 1).stream())
        page = snapshots[:normalized_limit]

        next_cursor = None
        if len(snapshots) > normalized_limit and page:
            last_snapshot = page[-1]
            if normalized_order:
                next_cursor = self._encode_cursor(
                    [
                        last_snapshot.id if field == self.DOCUMENT_ID_FIELD else last_snapshot.get(field)
                        for field, _direction in normalized_order
                    ]
                )
            else:
                next_cursor = self._encode_cursor([last_snapshot.id])

        return {"items": [snapshot.to_dict() for snapshot in page], "nextCursor": next_cursor}

    def find_by_fields_with_ids(self, collection: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
        query = self._apply_filters(collection, filters)

        items: list[dict[str, Any]] = []
        for snap in query.stream():
            data = snap.to_dict()
            data["_id"] = snap.id
            items.append(data)
        return items

    def list_all(self, collection: str) -> list[dict[str, Any]]:
        items = []
        for snap in self._collection(collection).stream():
            items.append(snap.to_dict())
        return items

    def list_all_with_ids(self, collection: str) -> list[dict[str, Any]]:
        items = []
        for snap in self._collection(collection).stream():
            data = snap.to_dict()
            data["_id"] = snap.id
            items.append(data)
        return items


firestore_store = FirestoreStore()
