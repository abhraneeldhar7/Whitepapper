import json
from dataclasses import dataclass
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import HTTPException

HASHNODE_GRAPHQL_URL = "https://gql.hashnode.com/"


@dataclass
class ExternalDistributionError(Exception):
    status_code: int
    detail: str


class HashnodeDistributionService:
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

    def _request_json(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        request_headers = {"Accept": "application/json"}
        if headers:
            request_headers.update(headers)

        payload_bytes: bytes | None = None
        if body is not None:
            payload_bytes = json.dumps(body).encode("utf-8")
            request_headers.setdefault("Content-Type", "application/json")

        request = urllib_request.Request(
            url,
            data=payload_bytes,
            headers=request_headers,
            method="POST",
        )

        try:
            with urllib_request.urlopen(request, timeout=30) as response:
                raw_body = response.read().decode("utf-8").strip()
        except urllib_error.HTTPError as exc:
            raw_body = exc.read().decode("utf-8", errors="replace").strip()
            parsed_payload: Any = raw_body
            if raw_body:
                try:
                    parsed_payload = json.loads(raw_body)
                except json.JSONDecodeError:
                    parsed_payload = raw_body
            raise ExternalDistributionError(
                status_code=exc.code,
                detail=self._extract_error_message(parsed_payload, raw_body or str(exc.reason)),
            ) from exc
        except urllib_error.URLError as exc:
            raise ExternalDistributionError(
                status_code=502,
                detail="Unable to reach the external distribution service right now.",
            ) from exc

        if not raw_body:
            return {}

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError as exc:
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

    def fetch_publication_id(self, access_token: str) -> str:
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
        response = self._request_json(
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
            raise HTTPException(
                status_code=400,
                detail=self._extract_error_message(errors, "Failed to fetch Hashnode publications."),
            )

        me = response.get("data", {}).get("me", {})
        edges = me.get("publications", {}).get("edges", [])
        if not isinstance(edges, list):
            raise HTTPException(status_code=400, detail="Unable to resolve a Hashnode publication.")

        for edge in edges:
            node = edge.get("node") if isinstance(edge, dict) else None
            publication_id = str(node.get("id") or "").strip() if isinstance(node, dict) else ""
            if publication_id:
                return publication_id

        raise HTTPException(
            status_code=400,
            detail="No Hashnode publication was found for this account.",
        )

    def publish_post(self, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
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
        response = self._request_json(
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
            raise HTTPException(
                status_code=400,
                detail=self._extract_error_message(errors, "Failed to publish to Hashnode."),
            )

        post = response.get("data", {}).get("publishPost", {}).get("post")
        if not isinstance(post, dict):
            raise HTTPException(status_code=502, detail="Hashnode did not return a published post.")
        return post


hashnode_distribution_service = HashnodeDistributionService()
