from fastapi import HTTPException

from app.services.clerk_service import clerk_service
from app.core.reserved_paths import is_reserved_username
from app.core.firestore_store import firestore_store, utc_now
from app.services.slug_utils import normalize_slug
from app.services.storage_service import storage_service
from app.services.projects_service import projects_service
from app.services.papers_service import papers_service

class UserService:
    def _normalize_user_document(self, user_doc: dict) -> dict:
        normalized = dict(user_doc)

        description = normalized.get("description")
        normalized["description"] = description if isinstance(description, str) else ""

        preferences = normalized.get("preferences")
        if not isinstance(preferences, dict):
            preferences = {}
        normalized["preferences"] = {
            "showKeyboardEffect": bool(preferences.get("showKeyboardEffect", True)),
            "typingSoundEnabled": bool(preferences.get("typingSoundEnabled", True)),
        }

        return normalized

    def _find_user_by_email(self, email: str | None) -> dict | None:
        if not email:
            return None

        matches = firestore_store.find_by_fields("users", {"email": email})
        return matches[0] if matches else None

    def _derive_username_base(
        self,
        user_id: str,
        username: str | None = None,
        display_name: str | None = None,
        email: str | None = None,
    ) -> str:
        if username:
            candidate = normalize_slug(username)
            if candidate:
                return candidate
        if email and "@" in email:
            candidate = normalize_slug(email.split("@", 1)[0])
            if candidate:
                return candidate
        if display_name:
            candidate = normalize_slug(display_name)
            if candidate:
                return candidate
        return normalize_slug(f"user-{user_id[-8:]}")

    def _unique_username(self, base: str, user_id: str) -> str:
        value = base or normalize_slug(f"user-{user_id[-8:]}")
        if not value:
            value = f"user-{user_id[-8:]}"
        if is_reserved_username(value):
            value = f"{value}-user"

        existing_matches = firestore_store.find_by_fields("users", {"username": value})
        existing = existing_matches[0] if existing_matches else None
        if not existing or existing.get("userId") == user_id:
            return value

        for index in range(2, 100):
            candidate = f"{value}-{index}"
            if is_reserved_username(candidate):
                continue
            existing_matches = firestore_store.find_by_fields("users", {"username": candidate})
            existing = existing_matches[0] if existing_matches else None
            if not existing or existing.get("userId") == user_id:
                return candidate

        return f"{value}-{user_id[-6:].lower()}"

    def create_user(
        self,
        user_id: str,
        username: str | None = None,
        display_name: str | None = None,
        description: str | None = None,
        email: str | None = None,
        avatar_url: str | None = None,
    ) -> dict:
        existing = firestore_store.get("users", user_id)
        if existing:
            return self._normalize_user_document(existing)

        clerk_user = clerk_service.get_user(user_id)
        if not clerk_user:
            raise HTTPException(status_code=404, detail="Clerk user not found.")

        clerk_email = clerk_service.extract_primary_email(clerk_user) or email

        canonical_display_name = clerk_service.extract_display_name(clerk_user) or display_name
        canonical_username = clerk_user.username or username
        canonical_avatar_url = clerk_service.extract_avatar_url(clerk_user) or avatar_url

        username_base = self._derive_username_base(
            user_id,
            canonical_username,
            canonical_display_name,
            clerk_email,
        )
        username_value = self._unique_username(username_base, user_id)
        created = firestore_store.create(
            "users",
            {
                "userId": user_id,
                "displayName": canonical_display_name,
            "description": description if isinstance(description, str) else "",
                "email": None,
                "avatarUrl": canonical_avatar_url,
                "username": username_value,
                "plan": "free",
                "preferences": {
                    "showKeyboardEffect": True,
                    "typingSoundEnabled": True,
                },
                "createdAt": utc_now(),
            },
            doc_id=user_id,
        )
        return self._normalize_user_document(created)

    def update_user(self, user_id: str, user_doc: dict) -> dict:
        current = firestore_store.get("users", user_id)
        if not current:
            raise HTTPException(status_code=404, detail="User not found.")
        current = self._normalize_user_document(current)

        allowed_fields = {
            "displayName",
            "email",
            "avatarUrl",
            "username",
            "description",
            "preferences",
        }
        payload = {key: user_doc[key] for key in allowed_fields if key in user_doc}

        if payload.get("username"):
            payload["username"] = normalize_slug(payload["username"])
            if is_reserved_username(payload["username"]):
                raise HTTPException(status_code=409, detail="Username is reserved.")
            existing_matches = firestore_store.find_by_fields("users", {"username": payload["username"]})
            if any(existing.get("userId") != user_id for existing in existing_matches):
                raise HTTPException(status_code=409, detail="Username already taken.")

        if isinstance(payload.get("preferences"), dict):
            existing_preferences = current.get("preferences") if isinstance(current.get("preferences"), dict) else {}
            payload["preferences"] = {
                **existing_preferences,
                **payload["preferences"],
            }

        if "description" in payload and not isinstance(payload["description"], str):
            raise HTTPException(status_code=400, detail="description must be a string.")

        if not payload:
            return current

        firestore_store.update("users", user_id, payload)
        current.update(payload)
        return current

    def get_by_username(self, username: str) -> dict:
        raw_username = (username or "").strip()
        if raw_username.startswith("@"):
            raw_username = raw_username[1:]

        candidates: list[str] = []
        normalized_username = normalize_slug(raw_username)
        for candidate in (raw_username, normalized_username):
            if candidate and candidate not in candidates:
                candidates.append(candidate)

        for candidate in candidates:
            matches = firestore_store.find_by_fields("users", {"username": candidate})
            if matches:
                return self._normalize_user_document(matches[0])

        raise HTTPException(status_code=404, detail="User not found.")

    def get_by_id(self, user_id: str) -> dict:
        user = firestore_store.get("users", user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return self._normalize_user_document(user)

    def is_username_available(self, username: str, user_id: str | None = None) -> bool:
        normalized = normalize_slug(username)
        if not normalized or is_reserved_username(normalized):
            return False

        matches = firestore_store.find_by_fields("users", {"username": normalized})
        if not matches:
            return True
        return all(item.get("userId") == user_id for item in matches)

    def delete_user(self, user_id: str) -> dict[str, int]:
        deleted_counts: dict[str, int] = {}

        projects = firestore_store.find_by_fields("projects", {"ownerId": user_id})
        deleted_counts["projects"] = len(projects)
        for project in projects:
            project_id = project.get("projectId")
            if not project_id:
                continue
            projects_service.delete_with_dependencies(project_id, user_id)

        standalone_papers = firestore_store.find_by_fields("papers", {"ownerId": user_id})
        deleted_counts["papers"] = 0
        for paper in standalone_papers:
            if paper.get("projectId"):
                continue
            paper_id = paper.get("paperId")
            if not paper_id:
                continue
            papers_service.delete(paper_id)
            deleted_counts["papers"] += 1

        api_keys = firestore_store.find_by_fields("apiKeys", {"ownerId": user_id})
        deleted_counts["apiKeys"] = len(api_keys)
        for api_key in api_keys:
            key_id = api_key.get("keyId")
            if key_id:
                firestore_store.delete("apiKeys", key_id)

        storage_count = storage_service.delete_owner_assets(user_id)
        deleted_counts["storageObjects"] = storage_count

        firestore_store.delete("users", user_id)
        deleted_counts["users"] = 1
        return deleted_counts


user_service = UserService()
