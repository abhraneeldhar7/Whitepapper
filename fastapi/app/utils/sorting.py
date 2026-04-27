from __future__ import annotations

from datetime import datetime
from typing import Any


def to_timestamp(value: object) -> float:
    if not value:
        return 0.0
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except Exception:
        return 0.0


def sort_items_latest_first(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        items,
        key=lambda item: (
            to_timestamp(item.get("updatedAt")),
            to_timestamp(item.get("createdAt")),
        ),
        reverse=True,
    )
