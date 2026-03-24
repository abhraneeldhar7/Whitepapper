import json
import re
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, firestore, storage

from app.core.config import get_settings


def _parse_service_account_json(raw_value: str | None) -> dict | None:
    if not raw_value:
        return None

    candidate = raw_value.strip()
    if candidate.startswith('"') and candidate.endswith('"'):
        candidate = candidate[1:-1]
        candidate = candidate.replace('\\"', '"')

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Handle `.env` cases where private_key contains literal newlines.
        pattern = r'("private_key"\s*:\s*")(.+?)("\s*,\s*"client_email")'
        match = re.search(pattern, candidate, flags=re.DOTALL)
        if not match:
            raise

        private_key_raw = match.group(2)
        private_key_fixed = private_key_raw.replace(
            "\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")
        normalized = f"{candidate[:match.start(2)]}{private_key_fixed}{candidate[match.end(2):]}"
        return json.loads(normalized)


@lru_cache
def get_firebase_app() -> firebase_admin.App:
    settings = get_settings()
    service_account = _parse_service_account_json(settings.firebase_service_account_json)
    credential = (
        credentials.Certificate(service_account)
        if service_account
        else credentials.ApplicationDefault()
    )

    options: dict[str, str] = {}
    if settings.firebase_storage_bucket:
        options["storageBucket"] = settings.firebase_storage_bucket

    return firebase_admin.initialize_app(credential, options or None)

@lru_cache
def get_firestore_client() -> firestore.Client:
    app = get_firebase_app()
    settings = get_settings()
    if settings.firestore_database_id:
        return firestore.client(app=app, database_id=settings.firestore_database_id)
    return firestore.client(app=app)


@lru_cache
def get_storage_bucket() -> storage.bucket:
    app = get_firebase_app()
    return storage.bucket(app=app)
