from typing import Any

from fastapi import HTTPException
import httpx

from app.services.distributions.common import extract_error_message

DEVTO_ARTICLES_URL = "https://dev.to/api/articles"


class DevtoDistributionService:

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
                detail=extract_error_message(parsed_payload, response.text or "Dev.to request failed."),
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
