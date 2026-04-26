from __future__ import annotations

from typing import Any
from uuid import uuid4

from firebase_admin import firestore

from app.core.firebase_admin import get_firestore_client


class FirestoreStore:
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

    def find_by_fields(self, collection: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
        query = self._collection(collection)
        for field, value in filters.items():
            query = query.where(filter=firestore.FieldFilter(field, "==", value))
        return [snap.to_dict() for snap in query.stream()]

    def find_by_fields_with_ids(self, collection: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
        query = self._collection(collection)
        for field, value in filters.items():
            query = query.where(filter=firestore.FieldFilter(field, "==", value))

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
