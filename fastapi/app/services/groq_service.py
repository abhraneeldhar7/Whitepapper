from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

from groq import Groq

from app.core.config import get_settings

logger = logging.getLogger(__name__)



class GroqService:
    @staticmethod
    @lru_cache
    def _client() -> Groq | None:
        settings = get_settings()
        if not settings.groq_api_key:
            return None
        return Groq(api_key=settings.groq_api_key)

    def is_available(self) -> bool:
        return self._client() is not None

    @staticmethod
    def _parse_json_response(content: str) -> dict[str, Any] | None:
        text = (content or "").strip()
        if not text:
            return None

        try:
            parsed = json.loads(text)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end <= start:
                return None
            try:
                parsed = json.loads(text[start : end + 1])
                return parsed if isinstance(parsed, dict) else None
            except json.JSONDecodeError:
                return None

    def generate_paper_seo(
        self,
        *,
        paper_doc: dict[str, Any],
        author_name: str,
        article_section: str,
    ) -> dict[str, Any] | None:
        client = self._client()
        if client is None:
            return None

        trimmed_title = str((paper_doc.get("title") or "").strip())
        trimmed_author = (author_name or "").strip() or "Author"
        trimmed_section = (article_section or "").strip() or "General"
        trimmed_body = str((paper_doc.get("body") or "").strip())[:8000]

        system_prompt = (
            "You are an expert SEO editor. Return strictly valid JSON only with keys: "
            "metaDescription, ogDescription, twitterDescription, abstract, ogTags, keyTakeaways, faq, author_bio."
        )
        user_prompt = (
            "Generate SEO-safe copy and extractable content for a technical article.\n"
            "Rules:\n"
            "- metaDescription: 140-160 chars.\n"
            "- ogDescription: 110-180 chars.\n"
            "- twitterDescription: 90-160 chars.\n"
            "- abstract: 160-320 chars.\n"
            "- ogTags: array of 4-8 short lowercase tags.\n"
            "- keyTakeaways: array of 3 short (20-40 words) takeaways.\n"
            "- faq: array of 2-5 {question, answer} pairs; keep answers 20-60 words.\n"
            "- author_bio: one short sentence describing credentials.\n"
            "- Keep copy factual, no clickbait, do not invent external URLs or sources.\n"
            "- Use American English.\n"
            f"Article title: {trimmed_title}\n"
            f"Author name: {trimmed_author}\n"
            f"Article section: {trimmed_section}\n"
            f"Article body:\n{trimmed_body}"
        )

        try:
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = completion.choices[0].message.content if completion.choices else ""
            return self._parse_json_response(content or "")
        except Exception:
            logger.exception("Groq SEO generation failed for title=%s", trimmed_title)
            return None


groqService = GroqService()
