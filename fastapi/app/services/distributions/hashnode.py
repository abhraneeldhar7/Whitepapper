import httpx
from dataclasses import dataclass
from typing import Any

from app.services.distributions.common import extract_error_message

HASHNODE_GRAPHQL_URL = "https://gql.hashnode.com/"


@dataclass
class ExternalDistributionError(Exception):
    status_code: int
    detail: str


class HashnodeDistributionService:

    async def _request_json(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        request_headers = {"Accept": "application/json"}
        if headers:
            request_headers.update(headers)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json=body,
                    headers=request_headers,
                )
        except httpx.RequestError as exc:
            raise ExternalDistributionError(
                status_code=502,
                detail="Unable to reach the external distribution service right now.",
            ) from exc

        if response.is_error:
            try:
                parsed_payload: Any = response.json()
            except ValueError:
                parsed_payload = response.text
            raise ExternalDistributionError(
                status_code=response.status_code,
                detail=extract_error_message(parsed_payload, response.text or "Hashnode request failed."),
            )

        raw_body = response.text.strip()
        if not raw_body:
            return {}

        try:
            payload = response.json()
        except ValueError as exc:
            raise ExternalDistributionError(
                status_code=502,
                detail="Received an invalid response from the external distribution service.",
            ) from exc

        if not isinstance(payload, dict):
            raise ExternalDistributionError(
                status_code=502,
                detail="Received an unexpected response from the external distribution service.",
            )

        return payload

    async def fetch_publication_id(self, access_token: str) -> str:
        query = """
        query ResolvePublication($first: Int!) {
          me {
            publications(first: $first) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
        """
        response = await self._request_json(
            HASHNODE_GRAPHQL_URL,
            headers={
                "Authorization": access_token,
                "Content-Type": "application/json",
            },
            body={
                "query": query,
                "variables": {"first": 20},
            },
        )
        errors = response.get("errors")
        if errors:
            raise ExternalDistributionError(
                status_code=400,
                detail=extract_error_message(errors, "Failed to fetch Hashnode publications."),
            )

        me = response.get("data", {}).get("me", {})
        edges = me.get("publications", {}).get("edges", [])
        if not isinstance(edges, list):
            raise ExternalDistributionError(status_code=400, detail="Unable to resolve a Hashnode publication.")

        for edge in edges:
            node = edge.get("node") if isinstance(edge, dict) else None
            publication_id = str(node.get("id") or "").strip() if isinstance(node, dict) else ""
            if publication_id:
                return publication_id

        raise ExternalDistributionError(
            status_code=400,
            detail="No Hashnode publication was found for this account.",
        )

    async def publish_post(self, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
        mutation = """
        mutation PublishPost($input: PublishPostInput!) {
          publishPost(input: $input) {
            post {
              id
              slug
              url
            }
          }
        }
        """
        response = await self._request_json(
            HASHNODE_GRAPHQL_URL,
            headers={
                "Authorization": access_token,
                "Content-Type": "application/json",
            },
            body={
                "query": mutation,
                "variables": {"input": payload},
            },
        )
        errors = response.get("errors")
        if errors:
            raise ExternalDistributionError(
                status_code=400,
                detail=extract_error_message(errors, "Failed to publish to Hashnode."),
            )

        post = response.get("data", {}).get("publishPost", {}).get("post")
        if not isinstance(post, dict):
            raise ExternalDistributionError(status_code=502, detail="Hashnode did not return a published post.")
        return post


hashnode_distribution_service = HashnodeDistributionService()
