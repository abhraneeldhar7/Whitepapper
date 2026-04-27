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
    def _user_by_username_cache_key(self, username: str) -> str:
        return f"users:username:{username}"

    def _load_cached_user(self, key: str) -> dict | None:
        # Redis cache removed for users; always miss.
        return None

    def _set_cached_user(self, user_doc: dict) -> None:
        # No-op: user caching removed.
        return None

    def getcached_user__by_username(self, username: str) -> dict | None:
        return None

    def invalidate_user(self, username: str | None) -> None:
        # No-op for compatibility; Redis user cache has been removed.
        return None

    def _generate_username(self, email: str | None, user_id: str, fallback_username: str | None) -> str:
        base = ""
        if email and "@" in email:
            base = email.split("@", 1)[0]
        elif fallback_username:
            base = fallback_username
        else:
            base = f"user-{user_id[-6:].lower()}"

        base = normalize_slug(base)
        if not base:
            base = f"user-{user_id[-4:].lower()}"
        if is_reserved_username(base):
            base = f"{base}-user"

        matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: base})
        if all(item.get(USER_ID_KEY) == user_id for item in matches):
            return base

        while True:
            candidate = f"{base}-{secrets.token_hex(2)}"
            if is_reserved_username(candidate):
                continue
            matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: candidate})
            if all(item.get(USER_ID_KEY) == user_id for item in matches):
                return candidate

    @staticmethod
    def _ensure_updated_at(user_doc: dict) -> dict:
        if "updatedAt" in user_doc and isinstance(user_doc.get("updatedAt"), datetime):
            return user_doc

        fallback = user_doc.get("createdAt")
        if not isinstance(fallback, datetime):
            fallback = utc_now()
        user_doc["updatedAt"] = fallback

        user_id = user_doc.get(USER_ID_KEY)
        if user_id:
            firestore_store.update(USERS_COLLECTION, user_id, {"updatedAt": fallback})
        return user_doc

    def create_user(
        self,
        user_id: str,
        username: str | None = None,
        display_name: str | None = None,
        description: str | None = None,
        email: str | None = None,
        avatar_url: str | None = None,
    ) -> dict:
        existing = firestore_store.get(USERS_COLLECTION, user_id)
        if existing:
            return self._ensure_updated_at(existing)

        username_value = self._generate_username(email, user_id, username)
        now = utc_now()
        created = {
            USER_ID_KEY: user_id,
            "displayName": display_name,
            "description": description if isinstance(description, str) else "",
            "email": email,
            "avatarUrl": avatar_url,
            USERNAME_KEY: username_value,
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
        firestore_store.create(USERS_COLLECTION, created, doc_id=user_id)
        return created

    @staticmethod
    def _can_change_username(user_doc: dict) -> bool:
        updated_at = user_doc.get("updatedAt") or user_doc.get("createdAt")
        if not isinstance(updated_at, datetime):
            return True
        return utc_now() - updated_at >= USERNAME_UPDATE_COOLDOWN

    @staticmethod
    def _refresh_user_papers_after_username_change(user_id: str) -> None:
        papers = papers_service.list_owned(user_id)
        for paper in papers:
            paper_id = paper.get("paperId")
            if not paper_id:
                continue
            try:
                papers_service.update(paper_id, {}, force_metadata_refresh=True)
            except Exception:
                logger.exception(
                    "Failed to refresh paper metadata after username change for user_id=%s paper_id=%s",
                    user_id,
                    paper_id,
                )

    def update_user(self, user_id: str, user_doc: dict) -> dict:
        current = firestore_store.get(USERS_COLLECTION, user_id)
        if not current:
            raise HTTPException(status_code=404, detail="User not found.")
        current = self._ensure_updated_at(current)

        allowed_fields = {
            "displayName",
            "avatarUrl",
            USERNAME_KEY,
            "description",
            "preferences",
        }
        payload = {key: user_doc[key] for key in allowed_fields if key in user_doc}
        previous_username = current.get(USERNAME_KEY)
        username_changed = False

        if USERNAME_KEY in payload:
            next_username = normalize_slug(str(payload[USERNAME_KEY] or ""))
            if not next_username:
                raise HTTPException(status_code=400, detail="Username is required.")
            if is_reserved_username(next_username):
                raise HTTPException(status_code=409, detail="Username is reserved.")
            matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: next_username})
            if any(item.get(USER_ID_KEY) != user_id for item in matches):
                raise HTTPException(status_code=409, detail="Username already taken.")
            username_changed = next_username != previous_username
            if username_changed and not self._can_change_username(current):
                raise HTTPException(
                    status_code=429,
                    detail="Username can only be changed once every 7 days.",
                )
            payload[USERNAME_KEY] = next_username

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

        if username_changed:
            payload["updatedAt"] = utc_now()

        firestore_store.update(USERS_COLLECTION, user_id, payload)
        current.update(payload)
        self.invalidate_user(previous_username)
        if username_changed:
            self._refresh_user_papers_after_username_change(user_id)
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
        user_doc = self._ensure_updated_at(user_doc)
        return user_doc

    def get_by_id(self, user_id: str) -> dict:
        user_doc = firestore_store.get(USERS_COLLECTION, user_id)
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found.")
        return self._ensure_updated_at(user_doc)

    def is_username_available(self, username: str, user_id: str | None = None) -> bool:
        candidate = normalize_slug(username or "")
        if not candidate or is_reserved_username(candidate):
            return False
        matches = firestore_store.find_by_fields(USERS_COLLECTION, {USERNAME_KEY: candidate})
        return all(item.get(USER_ID_KEY) == user_id for item in matches)

    def delete_user_assets(self, user_id: str) -> int:
        return storage_service.delete_by_prefix(f"users/{user_id}/")

    def delete_user(self, user_id: str) -> dict[str, int]:
        user_doc = firestore_store.get(USERS_COLLECTION, user_id)
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

        projects = firestore_store.find_by_fields("projects", {"ownerId": user_id})
        for project in projects:
            result = projects_service.delete_cascade(project["projectId"])
            deleted_counts["projects"] += result.get("projects", 0)
            deleted_counts["collections"] += result.get("collections", 0)
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["apiKeys"] += result.get("apiKeys", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        remaining_collections = firestore_store.find_by_fields("collections", {"ownerId": user_id})
        for collection in remaining_collections:
            result = collections_service.delete_cascade(collection["collectionId"])
            deleted_counts["collections"] += result.get("collections", 0)
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        remaining_papers = papers_service.list_owned(user_id)
        for paper in remaining_papers:
            result = papers_service.delete_cascade(paper["paperId"])
            deleted_counts["papers"] += result.get("papers", 0)
            deleted_counts["storageObjects"] += result.get("storageObjects", 0)

        from app.services._dev_api_service import _dev_api_service

        deleted_counts["apiKeys"] += _dev_api_service.delete_by_owner(user_id)

        mcp_deleted = mcp_authorization_service.delete_user_data(user_id)
        deleted_counts["mcpTokens"] += mcp_deleted.get("mcpTokens", 0)
        deleted_counts["mcpUsageDocs"] += mcp_deleted.get("mcpUsageDocs", 0)
        deleted_counts["distributions"] += distributions_store_service.delete_user_distribution(user_id)
        deleted_counts["storageObjects"] += self.delete_user_assets(user_id)

        firestore_store.delete(USERS_COLLECTION, user_id)
        self.invalidate_user(user_doc.get(USERNAME_KEY))
        deleted_counts["users"] = 1
        return deleted_counts


user_service = UserService()
