from pydantic import BaseModel, Field

from app.schemas.entities import UserDoc


# Backward-compatible alias used by user endpoints.
UserProfile = UserDoc


class UserUpdate(BaseModel):
    displayName: str | None = None
    avatarUrl: str | None = None
    username: str | None = Field(default=None, min_length=2, max_length=80)
    description: str | None = None
    preferences: dict | None = None
