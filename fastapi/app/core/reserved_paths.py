from app.services.slug_utils import normalize_slug

ROOT_RESERVED_PATHS = {
    "api",
    "dashboard",
    "write",
    "settings",
    "sign-in",
    "sign-up",
    "sso-callback",
    "unauthorized",
    "404",
    "components",
    "integrations",
    "blog",
    "blogs",
    "privacy-policy",
    "terms-of-service",
    "docs",
    "_astro",
    "favicon.ico",
}

RESERVED_USERNAMES = {normalized for path in ROOT_RESERVED_PATHS if (normalized := normalize_slug(path))}
RESERVED_PAPER_SLUGS = set()
RESERVED_PROJECT_SLUGS = set()


def is_reserved_username(value: str | None) -> bool:
    normalized = normalize_slug(value or "")
    return bool(normalized) and normalized in RESERVED_USERNAMES


def is_reserved_paper_slug(value: str | None) -> bool:
    normalized = normalize_slug(value or "")
    return bool(normalized) and normalized in RESERVED_PAPER_SLUGS


def is_reserved_project_slug(value: str | None) -> bool:
    normalized = normalize_slug(value or "")
    return bool(normalized) and normalized in RESERVED_PROJECT_SLUGS
