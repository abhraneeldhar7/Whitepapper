from typing import Any

from fastapi import HTTPException
import httpx

DEVTO_ARTICLES_URL = "https://dev.to/api/articles"


class DevtoDistributionService:
    @staticmethod
    def _extract_error_message(payload: Any, fallback: str) -> str:
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

    async def publish_article(self, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "api-key": access_token,
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    DEVTO_ARTICLES_URL,
                    json=payload,
                    headers=headers,
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail="Unable to reach the external distribution service right now.",
            ) from exc

        if response.is_error:
            try:
                parsed_payload: Any = response.json()
            except ValueError:
                parsed_payload = response.text
            raise HTTPException(
                status_code=response.status_code,
                detail=self._extract_error_message(parsed_payload, response.text or "Dev.to request failed."),
            )

        try:
            resolved_payload = response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="Received an invalid response from Dev.to.") from exc

        if not isinstance(resolved_payload, dict):
            raise HTTPException(status_code=502, detail="Received an unexpected response from Dev.to.")

        article_id = resolved_payload.get("id")
        if article_id is None:
            raise HTTPException(status_code=502, detail="Dev.to did not return a published article.")
        return resolved_payload


devto_distribution_service = DevtoDistributionService()
