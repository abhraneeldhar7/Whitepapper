from __future__ import annotations

import re

MARKDOWN_IMAGE_PATTERN = re.compile(r"!\[[^\]]*]\(([^)\s]+)", re.IGNORECASE)
HTML_IMAGE_PATTERN = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.IGNORECASE)


def extract_image_urls(content: str) -> set[str]:
    urls: set[str] = set()
    for match in MARKDOWN_IMAGE_PATTERN.findall(content):
        urls.add(match)
    for match in HTML_IMAGE_PATTERN.findall(content):
        urls.add(match)
    return urls
