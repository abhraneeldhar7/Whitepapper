import logging
import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException

from app.core.firestore_store import firestore_store
from app.core.reserved_paths import is_reserved_username
from app.services.collections_service import collections_service
from app.services.distributions import distributions_store_service
from app.services.mcp_auth import mcp_authorization_service
from app.services.papers_service import papers_service
from app.services.projects_service import projects_service
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service
from app.utils.datetime import utc_now

logger = logging.getLogger(__name__)

USERS_COLLECTION = "users"
USER_ID_KEY = "userId"
USERNAME_KEY = "username"
USERNAME_UPDATE_COOLDOWN = timedelta(days=7)


class UserService:
    def _generate_username(self, email: str | None, userId: str, fallbackUsername: str | None) -> str:
        base = ""
        if email and "@" in email:
            base = email.split("@", 1)[0]
        elif fallbackUsername:
            base = fallbackUsername
        else:
            base = f"user-{userId[-6:].lower()}"

        base = normalize_slug(base)
        if not base:
            base = f"user-{userId[-4:].lower()}"
        if is_reserved_username(base):
            base = f"{base}-user"

        matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: base})
        if all(item.get(USER_ID_KEY) == userId for item in matches):
            return base

        while True:
            candidate = f"{base}-{secrets.token_hex(2)}"
            if is_reserved_username(candidate):
                continue
            matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: candidate})
            if all(item.get(USER_ID_KEY) == userId for item in matches):
                return candidate

    @staticmethod
    def _ensure_updatedAt(user_doc: dict) -> dict:
        if "updatedAt" in user_doc and isinstance(user_doc.get("updatedAt"), datetime):
            return user_doc

        fallback = user_doc.get("createdAt")
        if not isinstance(fallback, datetime):
            fallback = utc_now()
        user_doc["updatedAt"] = fallback

        userId = user_doc.get(USER_ID_KEY)
        if userId:
            firestore_store.update(USERS_COLLECTION, userId, {"updatedAt": fallback})
        return user_doc

    def create_user(
        self,
        userId: str,
        username: str | None = None,
        displayName: str | None = None,
        description: str | None = None,
        email: str | None = None,
        avatarUrl: str | None = None,
    ) -> dict:
        existing = firestore_store.get(USERS_COLLECTION, userId)
        if existing:
            return self._ensure_updatedAt(existing)

        usernameValue = self._generate_username(email, userId, username)
        now = utc_now()
        created = {
            USER_ID_KEY: userId,
            "displayName": displayName,
            "description": description if isinstance(description, str) else "",
            "email": email,
            "avatarUrl": avatarUrl,
            USERNAME_KEY: usernameValue,
            "plan": "free",
            "preferences": {
                "showKeyboardEffect": True,
                "typingSoundEnabled": True,
                "hashnodeStoreInCloud": False,
                "hashnodeIntegrated": False,
                "devtoStoreInCloud": False,
                "devtoIntegrated": False,
            },
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(USERS_COLLECTION, created, doc_id=userId)
        return created

    @staticmethod
    def _can_change_username(user_doc: dict) -> bool:
        updatedAt = user_doc.get("updatedAt") or user_doc.get("createdAt")
        if not isinstance(updatedAt, datetime):
            return True
        return utc_now() - updatedAt >= USERNAME_UPDATE_COOLDOWN

    def update_user(self, userId: str, user_doc: dict) -> dict:
        current = firestore_store.get(USERS_COLLECTION, userId)
        if not current:
            raise HTTPException(status_code=404, detail="User not found.")
        current = self._ensure_updatedAt(current)

        allowed_fields = {
            "displayName",
            "avatarUrl",
            USERNAME_KEY,
            "description",
            "preferences",
        }
        payload = {key: user_doc[key] for key in allowed_fields if key in user_doc}
        previousUsername = current.get(USERNAME_KEY)
        usernameChanged = False

        if USERNAME_KEY in payload:
            nextUsername = normalize_slug(str(payload[USERNAME_KEY] or ""))
            if not nextUsername:
                raise HTTPException(status_code=400, detail="Username is required.")
            if is_reserved_username(nextUsername):
                raise HTTPException(status_code=409, detail="Username is reserved.")
            matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: nextUsername})
            if any(item.get(USER_ID_KEY) != userId for item in matches):
                raise HTTPException(status_code=409, detail="Username already taken.")
            usernameChanged = nextUsername != previousUsername
            if usernameChanged and not self._can_change_username(current):
                raise HTTPException(
                    status_code=429,
                    detail="Username can only be changed once every 7 days.",
                )
            payload[USERNAME_KEY] = nextUsername

        if "description" in payload and not isinstance(payload["description"], str):
            raise HTTPException(status_code=400, detail="description must be a string.")

        if "preferences" in payload:
            if not isinstance(payload["preferences"], dict):
                raise HTTPException(status_code=400, detail="preferences must be an object.")
            existing_preferences = current.get("preferences")
            if not isinstance(existing_preferences, dict):
                existing_preferences = {}
            payload["preferences"] = {
                **existing_preferences,
                **payload["preferences"],
            }

        if not payload:
            return current

        if usernameChanged:
            payload["updatedAt"] = utc_now()

        firestore_store.update(USERS_COLLECTION, userId, payload)
        current.update(payload)
        return current

    def get_by_username(self, username: str) -> dict:
        value = (username or "").strip().lower()
        if "@" in value:
            raise HTTPException(status_code=404, detail="User not found.")
        if not value:
            raise HTTPException(status_code=404, detail="User not found.")
        matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: value})
        if not matches:
            raise HTTPException(status_code=404, detail="User not found.")

        user_doc = matches[0]
        user_doc = self._ensure_updatedAt(user_doc)
        return user_doc

    def get_by_id(self, userId: str) -> dict:
        user_doc = firestore_store.get(USERS_COLLECTION, userId)
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found.")
        return self._ensure_updatedAt(user_doc)

    def is_username_available(self, username: str, userId: str | None = None) -> bool:
        candidate = normalize_slug(username or "")
        if not candidate or is_reserved_username(candidate):
            return False
        matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: candidate})
        return all(item.get(USER_ID_KEY) == userId for item in matches)

    def delete_user_assets(self, userId: str) -> int:
        return storage_service.delete_by_prefix(f"users/{userId}/")

    def delete_user(self, userId: str) -> dict[str, int]:
        user_doc = firestore_store.get(USERS_COLLECTION, userId)
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found.")

        deleted_counts = {
            "projects": 0,
            "collections": 0,
            "papers": 0,
            "apiKeys": 0,
            "mcpTokens": 0,
            "mcpUsageDocs": 0,
            "distributions": 0,
            "storageObjects": 0,
            "users": 0,
        }

        projects = firestore_store.find_by_fields("projects", {"ownerId": userId})
        for project in projects:
            result = projects_service.delete_cascade(project["projectId"])
            deleted_counts["projects"] += result.get("projects", 0)
            deleted_counts["collections"] += result.get("collections", 0)
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["apiKeys"] += result.get("apiKeys", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        remaining_collections = firestore_store.find_by_fields("collections", {"ownerId": userId})
        for collection in remaining_collections:
            result = collections_service.delete_cascade(collection["collectionId"])
            deleted_counts["collections"] += result.get("collections", 0)
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        remaining_papers = papers_service.list_owned(userId)
        for paper in remaining_papers:
            result = papers_service.delete_cascade(paper["paperId"])
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        from app.services.dev_api_service import dev_api_service

        deleted_counts["apiKeys"] += dev_api_service.delete_by_owner(userId)

        mcp_deleted = mcp_authorization_service.delete_user_data(userId)
        deleted_counts["mcpTokens"] += mcp_deleted.get("mcpTokens", 0)
        deleted_counts["mcpUsageDocs"] += mcp_deleted.get("mcpUsageDocs", 0)
        deleted_counts["distributions"] += distributions_store_service.delete_user_distribution(userId)
        deleted_counts["storageObjects"] += self.delete_user_assets(userId)

        firestore_store.delete(USERS_COLLECTION, userId)
        deleted_counts["users"] = 1
        return deleted_counts


user_service = UserService()
