from typing import Any


def extract_error_message(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        detail = payload.get("detail")
        if isinstance(detail, str) and detail.strip():
            return detail.strip()

        message = payload.get("message") or payload.get("error")
        if isinstance(message, str) and message.strip():
            return message.strip()

        errors = payload.get("errors")
        if isinstance(errors, list):
            for item in errors:
                if isinstance(item, str) and item.strip():
                    return item.strip()
                if isinstance(item, dict):
                    for key in ("message", "detail", "error"):
                        value = item.get(key)
                        if isinstance(value, str) and value.strip():
                            return value.strip()
        if isinstance(errors, dict):
            flattened: list[str] = []
            for value in errors.values():
                if isinstance(value, list):
                    flattened.extend(str(item).strip() for item in value if str(item).strip())
                elif isinstance(value, str) and value.strip():
                    flattened.append(value.strip())
            if flattened:
                return "; ".join(flattened)

    if isinstance(payload, list):
        messages = [str(item).strip() for item in payload if str(item).strip()]
        if messages:
            return "; ".join(messages)

    return fallback
