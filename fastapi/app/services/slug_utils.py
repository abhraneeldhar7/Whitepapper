import re

SLUG_PATTERN = re.compile(r"[^a-z0-9-]")


def normalize_slug(value: str) -> str:
    raw = value.strip().lower().replace(" ", "-")
    raw = SLUG_PATTERN.sub("-", raw)
    while "--" in raw:
        raw = raw.replace("--", "-")
    return raw.strip("-")
