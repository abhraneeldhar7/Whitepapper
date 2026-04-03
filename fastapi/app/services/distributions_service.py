import json
from dataclasses import dataclass
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import HTTPException

from app.core.firestore_store import firestore_store

DISTRIBUTIONS_COLLECTION = "distributions"
HASHNODE_GRAPHQL_URL = "https://gql.hashnode.com/"
DEVTO_ARTICLES_URL = "https://dev.to/api/articles"
_UNSET = object()


@dataclass
class ExternalDistributionError(Exception):
    status_code: int
    detail: str


class DistributionsService:
    def get_by_user_id(self, user_id: str) -> dict:
        doc = firestore_store.get(DISTRIBUTIONS_COLLECTION, user_id)
        if doc:
            return doc
        return {
            "userId": user_id,
            "hashnode": None,
            "devto": None,
        }

    def _replace_distribution_doc(self, user_id: str, distribution_doc: dict) -> dict:
        distribution_doc["userId"] = user_id
        firestore_store.update(DISTRIBUTIONS_COLLECTION, user_id, distribution_doc, merge=False)
        return distribution_doc

    def _update_hashnode_distribution(
        self,
        user_id: str,
        *,
        access_token: str | None | object = _UNSET,
        publication_id: str | None | object = _UNSET,
    ) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        current_hashnode = existing_doc.get("hashnode")
        next_hashnode = dict(current_hashnode) if isinstance(current_hashnode, dict) else {}

        if access_token is not _UNSET:
            if access_token:
                next_hashnode["accessToken"] = access_token
            else:
                next_hashnode.pop("accessToken", None)

        if publication_id is not _UNSET:
            if publication_id:
                next_hashnode["publicationId"] = publication_id
            else:
                next_hashnode.pop("publicationId", None)

        existing_doc["hashnode"] = next_hashnode or None
        return self._replace_distribution_doc(user_id, existing_doc)

    def upsert_hashnode_access_token(self, user_id: str, access_token: str) -> dict:
        return self._update_hashnode_distribution(user_id, access_token=access_token)

    def clear_hashnode_access_token(self, user_id: str) -> dict:
        return self._update_hashnode_distribution(user_id, access_token=None)

    def set_hashnode_publication_id(self, user_id: str, publication_id: str) -> dict:
        return self._update_hashnode_distribution(user_id, publication_id=publication_id)

    def remove_hashnode_distribution(self, user_id: str) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        existing_doc["hashnode"] = None
        return self._replace_distribution_doc(user_id, existing_doc)

    def upsert_devto_access_token(self, user_id: str, access_token: str) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        existing_doc["devto"] = {
            "accessToken": access_token,
        }
        return self._replace_distribution_doc(user_id, existing_doc)

    def remove_devto_access_token(self, user_id: str) -> dict:
        existing_doc = self.get_by_user_id(user_id)
        existing_doc["devto"] = None
        return self._replace_distribution_doc(user_id, existing_doc)

    def get_hashnode_access_token(self, user_id: str) -> str | None:
        hashnode = self.get_by_user_id(user_id).get("hashnode")
        if not isinstance(hashnode, dict):
            return None
        access_token = str(hashnode.get("accessToken") or "").strip()
        return access_token or None

    def get_devto_access_token(self, user_id: str) -> str | None:
        devto = self.get_by_user_id(user_id).get("devto")
        if not isinstance(devto, dict):
            return None
        access_token = str(devto.get("accessToken") or "").strip()
        return access_token or None

    def get_hashnode_publication_id(self, user_id: str) -> str | None:
        hashnode = self.get_by_user_id(user_id).get("hashnode")
        if not isinstance(hashnode, dict):
            return None
        publication_id = str(hashnode.get("publicationId") or "").strip()
        return publication_id or None

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
        method: str = "POST",
        headers: dict[str, str] | None = None,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        request_headers = {
            "Accept": "application/json",
        }
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
            method=method,
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

    def fetch_hashnode_publication_id(self, access_token: str) -> str:
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

    def publish_hashnode_post(self, access_token: str, payload: dict[str, Any]) -> dict[str, Any]:
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

    def publish_devto_article(self, access_token: str, article_payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "api-key": access_token,
            "Content-Type": "application/json",
            "Accept": "application/vnd.forem.api-v1+json",
            # Dev.to bot detection can reject requests without a user agent.
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://dev.to/",
        }
        request_body = {"article": article_payload}

        try:
            response = self._request_json(
                DEVTO_ARTICLES_URL,
                headers=headers,
                body=request_body,
            )
        except ExternalDistributionError as exc:
            tags = article_payload.get("tags")
            if exc.status_code == 422 and isinstance(tags, list) and tags:
                retry_payload = {
                    **article_payload,
                    "tags": ",".join(tags),
                }
                try:
                    response = self._request_json(
                        DEVTO_ARTICLES_URL,
                        headers=headers,
                        body={"article": retry_payload},
                    )
                except ExternalDistributionError as retry_exc:
                    raise HTTPException(status_code=retry_exc.status_code, detail=retry_exc.detail) from retry_exc
            else:
                raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

        article_id = response.get("id")
        if article_id is None:
            raise HTTPException(status_code=502, detail="Dev.to did not return a published article.")
        return response


distributions_service = DistributionsService()
