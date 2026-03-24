import hashlib
from uuid import uuid4

from fastapi import HTTPException

from app.core.constants import API_KEY_LIMIT_PER_MONTH
from app.core.firestore_store import firestore_store, utc_now


class DevApiService:
    def create(self, owner_id: str, project_id: str) -> dict:
        existing = firestore_store.find_by_fields("apiKeys", {"projectId": project_id})
        if existing:
            raise HTTPException(status_code=409, detail="A key already exists for this project. Delete it first.")

        raw_key = f"wp_{uuid4().hex}"
        key_id = str(uuid4())
        key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
        created = firestore_store.create(
            "apiKeys",
            {
                "keyId": key_id,
                "ownerId": owner_id,
                "projectId": project_id,
                "keyHash": key_hash,
                "usage": 0,
                "limitPerMonth": API_KEY_LIMIT_PER_MONTH,
                "isActive": True,
                "createdAt": utc_now(),
            },
            doc_id=key_id,
        )
        public_doc = {key: value for key, value in created.items() if key != "keyHash"}
        public_doc["rawKey"] = raw_key
        return public_doc

    def toggle_active(self, key_id: str, owner_id: str, is_active: bool) -> dict:
        current = firestore_store.get("apiKeys", key_id)
        if not current:
            raise HTTPException(status_code=404, detail="API key not found.")
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
        firestore_store.update("apiKeys", key_id, {"isActive": is_active})
        current["isActive"] = is_active
        return {key: value for key, value in current.items() if key != "keyHash"}

    def delete(self, key_id: str, owner_id: str) -> dict[str, bool]:
        current = firestore_store.get("apiKeys", key_id)
        if not current:
            raise HTTPException(status_code=404, detail="API key not found.")
        if current.get("ownerId") != owner_id:
            raise HTTPException(status_code=403, detail="Not allowed.")
        firestore_store.delete("apiKeys", key_id)
        return {"ok": True}

    @staticmethod
    def hash_raw_key(raw_key: str) -> str:
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def validate_key(self, raw_key: str) -> dict:
        key_hash = self.hash_raw_key(raw_key)
        matches = firestore_store.find_by_fields("apiKeys", {"keyHash": key_hash})
        key_doc = matches[0] if matches else None
        if not key_doc:
            raise HTTPException(status_code=401, detail="Invalid API key.")

        if not key_doc.get("isActive", True):
            raise HTTPException(status_code=403, detail="API key is inactive.")

        limit = int(key_doc.get("limitPerMonth", API_KEY_LIMIT_PER_MONTH))
        usage = int(key_doc.get("usage", 0))
        if usage >= limit:
            raise HTTPException(status_code=429, detail="Monthly API limit exceeded.")

        return key_doc

    def increment_usage(self, key_id: str) -> None:
        try:
            firestore_store.increment("apiKeys", key_id, "usage", 1)
        except Exception:
            pass

    def reset_all_usage(self) -> int:
        all_keys = firestore_store.list_all("apiKeys")
        count = 0
        for key in all_keys:
            if int(key.get("usage", 0)) > 0:
                key_id = key.get("keyId")
                if not key_id:
                    continue
                firestore_store.update("apiKeys", key_id, {"usage": 0})
                count += 1
        return count


_dev_api_service = DevApiService()
