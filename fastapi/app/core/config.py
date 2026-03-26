from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Whitepapper_API"

    clerk_webhook_signing_secret: str | None = None
    clerk_secret_key: str | None = None
    clerk_jwt_key: str | None = None
    clerk_authorized_parties: str | None = None

    firebase_service_account_json: str | None = None
    firebase_storage_bucket: str | None = None
    firestore_database_id: str | None = None

    cron_secret: str | None = None

    valkey_service_uri: str | None = None
    valkey_host: str | None = None
    valkey_port: int | None = None
    valkey_user: str | None = None
    valkey_password: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
