from __future__ import annotations

import base64
import json
from typing import Any


def normalize_page_limit(limit: int | None) -> int:
    return max(1, min(int(limit or 25), 100))


def _encode_cursor(offset: int) -> str:
    payload = json.dumps({"offset": int(offset)}, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return base64.urlsafe_b64encode(payload).decode("ascii")


def _decode_cursor(cursor: str | None) -> int:
    raw_value = str(cursor or "").strip()
    if not raw_value:
        return 0
    try:
        decoded = base64.urlsafe_b64decode(raw_value.encode("ascii")).decode("utf-8")
        payload = json.loads(decoded)
    except Exception as exc:
        raise ValueError("Invalid cursor.") from exc
    if not isinstance(payload, dict):
        raise ValueError("Invalid cursor.")
    offset = payload.get("offset")
    if not isinstance(offset, int) or offset < 0:
        raise ValueError("Invalid cursor.")
    return offset


def apply_order_by(items: list[dict[str, Any]], order_by: list[tuple[str, str]] | None = None) -> list[dict[str, Any]]:
    if not order_by:
        return list(items)

    ordered = list(items)
    for field, direction in reversed(order_by):
        descending = str(direction or "").strip().upper() == "DESCENDING"
        ordered.sort(key=lambda item: str(item.get(field) or ""), reverse=descending)
    return ordered


def paginate_items(items: list[dict[str, Any]], limit: int | None = 25, cursor: str | None = None) -> dict[str, Any]:
    normalized_limit = normalize_page_limit(limit)
    start = _decode_cursor(cursor)
    if start >= len(items):
        return {"items": [], "nextCursor": None}

    end = start + normalized_limit
    page_items = items[start:end]
    next_cursor = _encode_cursor(end) if end < len(items) else None
    return {"items": page_items, "nextCursor": next_cursor}
