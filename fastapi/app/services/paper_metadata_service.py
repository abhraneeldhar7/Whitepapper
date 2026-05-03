from __future__ import annotations

import hashlib
import json
import re
import threading
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit

from app.core.config import get_settings
from app.utils.content import HTML_IMAGE_PATTERN, MARKDOWN_IMAGE_PATTERN
from app.services.groq_service import groqService

DEFAULT_LICENSE = "https://creativecommons.org/licenses/by/4.0/"
DEFAULT_OG_WIDTH = 1200
DEFAULT_OG_HEIGHT = 630
DEFAULT_LANGUAGE = "en"
DEFAULT_OG_LOCALE = "en_US"
READING_SPEED_WPM = 220
STOP_WORDS = {
    "a",
    "an",
    "and",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
}


def _strip_trailing_slash(value: str) -> str:
    return value[:-1] if value.endswith("/") else value


_metadata_cache: dict = {}
_METADATA_CACHE_TTL = 300
_metadata_cache_lock = threading.Lock()


def _normalize_site_url() -> str:
    settings = get_settings()
    value = (settings.public_site_url or "").strip()
    if value:
        parsed = urlsplit(value)
        if parsed.scheme in {"http", "https"} and parsed.netloc:
            normalized = urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
            return _strip_trailing_slash(normalized)

    raise RuntimeError("PUBLIC_SITE_URL must be configured in FastAPI env.")


def _to_utc_iso8601(value: datetime | str | None) -> str:
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str) and value.strip():
        text = value.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _strip_markdown(text: str) -> str:
    value = text or ""
    value = re.sub(r"```.*?```", " ", value, flags=re.DOTALL)
    value = re.sub(r"`[^`]+`", " ", value)
    value = re.sub(r"!\[[^\]]*]\([^)]+\)", " ", value)
    value = re.sub(r"\[([^\]]+)]\([^)]+\)", r"\1", value)
    value = re.sub(r"#+\s*", "", value)
    value = re.sub(r"[*_~>-]", " ", value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _extract_first_image_url(body: str) -> str:
    if not body:
        return ""

    markdown_match = MARKDOWN_IMAGE_PATTERN.search(body)
    if markdown_match:
        return (markdown_match.group(1) or "").strip()

    html_match = HTML_IMAGE_PATTERN.search(body)
    if html_match:
        return (html_match.group(1) or "").strip()

    return ""


def _truncate(text: str, max_len: int) -> str:
    value = re.sub(r"\s+", " ", (text or "").strip())
    if len(value) <= max_len:
        return value
    shortened = value[: max_len - 1].rstrip()
    cut = shortened.rfind(" ")
    if cut > max_len // 2:
        shortened = shortened[:cut]
    return f"{shortened}..."


def _safe_description(value: str, fallback: str, max_len: int) -> str:
    text = _truncate((value or "").strip(), max_len)
    return text or _truncate(fallback, max_len)


def _extract_tags_from_text(*items: str, limit: int = 6) -> list[str]:
    seen: set[str] = set()
    tags: list[str] = []
    combined = " ".join(item or "" for item in items)
    for token in re.findall(r"[a-zA-Z0-9][a-zA-Z0-9\-_]+", combined.lower()):
        if token in STOP_WORDS or len(token) < 3:
            continue
        if token in seen:
            continue
        seen.add(token)
        tags.append(token)
        if len(tags) >= limit:
            break
    return tags


def _sanitize_tags(value: object, fallback_source: str) -> list[str]:
    if isinstance(value, list):
        tags = []
        seen: set[str] = set()
        for item in value:
            token = re.sub(r"\s+", " ", str(item or "").strip().lower())
            token = re.sub(r"[^a-z0-9\-\s]", "", token).strip()
            if not token or token in seen:
                continue
            seen.add(token)
            tags.append(token)
            if len(tags) >= 8:
                break
        if tags:
            return tags
    return _extract_tags_from_text(fallback_source, "whitepaper", limit=6) or ["whitepaper"]


def build_article_jsonld(
    *,
    title: str,
    description: str,
    author_name: str,
    url: str | None = None,
    date_published: str | None = None,
    date_modified: str | None = None,
    publisher_name: str | None = None,
    publisher_url: str | None = None,
    image: str | None = None,
    section: str | None = None,
    keywords: list[str] | None = None,
) -> dict:
    jsonld: dict = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "description": description,
        "author": {"@type": "Person", "name": author_name},
    }
    if publisher_name:
        pub: dict = {"@type": "Organization", "name": publisher_name}
        if publisher_url:
            pub["url"] = publisher_url
        jsonld["publisher"] = pub
    if url:
        jsonld["mainEntityOfPage"] = {"@type": "WebPage", "@id": url}
        jsonld["url"] = url
    if date_published:
        jsonld["datePublished"] = date_published
    if date_modified:
        jsonld["dateModified"] = date_modified
    if image:
        jsonld["image"] = {"@type": "ImageObject", "url": image}
    if section:
        jsonld["articleSection"] = section
    if keywords:
        jsonld["keywords"] = ", ".join(keywords)
    return jsonld


class PaperMetadataService:
    def build_metadata(self, *, paper_doc: dict, author_doc: dict | None, project_doc: dict | None = None) -> dict:
        site_url = _normalize_site_url()

        cache_key = hashlib.sha256(json.dumps({
            "title": paper_doc.get("title"),
            "body": (paper_doc.get("body") or "")[:200],
            "slug": paper_doc.get("slug"),
            "author": (author_doc or {}).get("username"),
            "project": (project_doc or {}).get("name"),
        }, sort_keys=True).encode()).hexdigest()

        with _metadata_cache_lock:
            cached = _metadata_cache.get(cache_key)
            if cached and time.time() - cached[0] < _METADATA_CACHE_TTL:
                return cached[1]

        title = (paper_doc.get("title") or "Untitled Paper").strip() or "Untitled Paper"
        slug = (paper_doc.get("slug") or "").strip()
        body = paper_doc.get("body") or ""
        owner_id = str(paper_doc.get("ownerId") or "")
        thumbnail_url = (paper_doc.get("thumbnailUrl") or "").strip()
        embedded_image_url = _extract_first_image_url(body)

        username = (author_doc or {}).get("username")
        username = (username or "author").strip().lstrip("@").lower()
        display_name = ((author_doc or {}).get("displayName") or "").strip() or username
        project_name = ((project_doc or {}).get("name") or "").strip()
        article_section = project_name or str(paper_doc.get("projectId") or "General")

        canonical = f"{site_url}/{username}/{slug}".rstrip("/")
        author_url = f"{site_url}/{username}"
        image_url = thumbnail_url or embedded_image_url or f"{site_url}/appLogo.png"
        created_at = _to_utc_iso8601(paper_doc.get("createdAt"))
        updated_at = _to_utc_iso8601(paper_doc.get("updatedAt"))

        plain_text_body = _strip_markdown(body)
        excerpt_seed = plain_text_body or title
        fallback_meta = _safe_description(
            f"{title} by {display_name}. {excerpt_seed}",
            fallback=title,
            max_len=160,
        )
        fallback_og = _safe_description(
            f"{title}. {excerpt_seed}",
            fallback=fallback_meta,
            max_len=180,
        )
        fallback_twitter = _safe_description(
            fallback_og,
            fallback=fallback_meta,
            max_len=160,
        )
        fallback_abstract = _safe_description(
            excerpt_seed,
            fallback=title,
            max_len=320,
        )

        ai_payload = groqService.generate_paper_seo(
            paper_doc=paper_doc,
            author_name=display_name,
            article_section=article_section,
        ) or {}

        ai_meta_description = str(ai_payload.get("metaDescription") or "")
        ai_og_description = str(ai_payload.get("ogDescription") or "")
        ai_twitter_description = str(ai_payload.get("twitterDescription") or "")
        ai_abstract = str(ai_payload.get("abstract") or "")
        ai_key_takeaways = ai_payload.get("keyTakeaways") if isinstance(ai_payload.get("keyTakeaways"), list) else []
        ai_faq = ai_payload.get("faq") if isinstance(ai_payload.get("faq"), list) else []
        ai_author_bio = str(ai_payload.get("author_bio") or "")

        og_tags = _sanitize_tags(ai_payload.get("ogTags"), f"{title} {article_section}")
        word_count = len(re.findall(r"\b\w+\b", plain_text_body))
        reading_time_minutes = max(1, (max(word_count, 1) + READING_SPEED_WPM - 1) // READING_SPEED_WPM)

        meta_description = _safe_description(ai_meta_description, fallback=fallback_meta, max_len=160)
        og_description = _safe_description(ai_og_description, fallback=fallback_og, max_len=180)
        twitter_description = _safe_description(ai_twitter_description, fallback=fallback_twitter, max_len=160)
        abstract = _safe_description(ai_abstract, fallback=fallback_abstract, max_len=320)
        robots = "index, follow"

        result = {
            "title": f"{title} - by {display_name} | Whitepapper",
            "metaDescription": meta_description,
            "canonical": canonical,
            "robots": robots,
            "ogTitle": title,
            "ogDescription": og_description,
            "ogImage": image_url,
            "ogImageWidth": DEFAULT_OG_WIDTH,
            "ogImageHeight": DEFAULT_OG_HEIGHT,
            "ogImageAlt": f"Cover image for {title}",
            "ogLocale": DEFAULT_OG_LOCALE,
            "ogPublishedTime": created_at,
            "ogModifiedTime": updated_at,
            "ogAuthorUrl": author_url,
            "ogTags": og_tags,
            "twitterTitle": title,
            "twitterDescription": twitter_description,
            "twitterImage": image_url,
            "twitterImageAlt": f"Cover image for {title}",
            "twitterCreator": None,
            "headline": title,
            "abstract": abstract,
            "keywords": ", ".join(og_tags),
            "articleSection": article_section,
            "wordCount": max(word_count, 0),
            "readingTimeMinutes": reading_time_minutes,
            "inLanguage": DEFAULT_LANGUAGE,
            "datePublished": created_at,
            "dateModified": updated_at,
            "authorName": display_name,
            "authorHandle": username,
            "authorUrl": author_url,
            "authorId": owner_id,
            "coverImageUrl": image_url,
            "publisherName": "Whitepapper",
            "publisherUrl": site_url,
            "isAccessibleForFree": True,
            "license": DEFAULT_LICENSE,
            # AI-provided items (non-deterministic)
            "keyTakeaways": ai_key_takeaways,
            "faq": ai_faq,
            "authorBio": ai_author_bio,
            # JSON-LD built server-side and stored for rendering
            "jsonLd": build_article_jsonld(
                title=title,
                description=meta_description,
                author_name=display_name,
                url=canonical,
                date_published=created_at,
                date_modified=updated_at,
                publisher_name="Whitepapper",
                publisher_url=site_url,
                image=image_url,
                section=article_section,
                keywords=og_tags,
            ),
        }

        with _metadata_cache_lock:
            _metadata_cache[cache_key] = (time.time(), result)

        return result


paper_metadata_service = PaperMetadataService()
