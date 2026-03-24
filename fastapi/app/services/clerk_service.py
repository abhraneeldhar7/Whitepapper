from __future__ import annotations

from functools import lru_cache

from clerk_backend_api import Clerk, models

from app.core.config import get_settings


def get_clerk_client() -> Clerk:
    settings = get_settings()
    if not settings.clerk_secret_key:
        raise RuntimeError("CLERK_SECRET_KEY is not configured.")
    return Clerk(bearer_auth=settings.clerk_secret_key)


class ClerkService:
    @staticmethod
    @lru_cache
    def _client() -> Clerk:
        return get_clerk_client()

    def get_user(self, user_id: str) -> models.User | None:
        try:
            return self._client().users.get(user_id=user_id)
        except models.ClerkErrors as exc:
            status_code = exc.raw_response.status_code if exc.raw_response is not None else None
            if status_code == 404:
                return None
            raise

    @staticmethod
    def extract_primary_email(user: models.User) -> str | None:
        if user.primary_email_address_id:
            for email_address in user.email_addresses:
                if email_address.id == user.primary_email_address_id:
                    return email_address.email_address

        if user.email_addresses:
            return user.email_addresses[0].email_address

        return None

    @staticmethod
    def extract_display_name(user: models.User) -> str | None:
        parts = [part.strip() for part in [user.first_name, user.last_name] if isinstance(part, str) and part.strip()]
        if parts:
            return " ".join(parts)
        return None

    @staticmethod
    def extract_avatar_url(user: models.User) -> str | None:
        return user.image_url or user.profile_image_url


clerk_service = ClerkService()