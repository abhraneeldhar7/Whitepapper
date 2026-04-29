from app.services.slug_utils import normalize_slug

ROOT_RESERVED_PATHS = {
    "api",
    "dashboard",
    "write",
    "settings",
    "sign-in",
    "sign-up",
    "welcome",
    "unauthorized",
    "404",
    "components",
    "integrations",
    "blog",
    "blogs",
    "updates",
    "resources",
    "features",
    "use-cases",
    "compare",
    "glossary",
    "pricing",
    "pricing.md",
    "rss.xml",
    "llms.txt",
    "llms-full.txt",
    "sitemap.xml",
    "sitemap-index.xml",
    "sitemaps",
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


def is_reserved_paperSlug(value: str | None) -> bool:
    normalized = normalize_slug(value or "")
    return bool(normalized) and normalized in RESERVED_PAPER_SLUGS


def is_reserved_projectSlug(value: str | None) -> bool:
    normalized = normalize_slug(value or "")
    return bool(normalized) and normalized in RESERVED_PROJECT_SLUGS
