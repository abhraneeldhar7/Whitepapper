from __future__ import annotations

import base64
import hashlib
from collections.abc import Iterable
from datetime import timedelta
from time import time
from urllib.parse import urlencode
from urllib.parse import urlparse
from uuid import uuid4

from mcp.server.auth.provider import AccessToken, OAuthToken, TokenVerifier

from app.core.config import get_settings
from app.core.firestore_store import firestore_store, utc_now
from app.core.limits import MCP_AUTH_CODE_TTL_SECONDS, MCP_AUTH_REQUEST_TTL_SECONDS
from app.services.mcp_auth import mcp_token_service

MCP_OAUTH_CLIENTS_COLLECTION = "mcp_oauth_clients"
MCP_OAUTH_SESSIONS_COLLECTION = "mcp_oauth_sessions"
LEGACY_MCP_OAUTH_REQUESTS_COLLECTION = "mcp_oauth_requests"
LEGACY_MCP_OAUTH_CODES_COLLECTION = "mcp_oauth_codes"


def _require_url(value: str | None, env_name: str) -> str:
    normalized = str(value or "").strip().rstrip("/")
    if not normalized:
        raise RuntimeError(f"{env_name} must be configured for MCP OAuth.")
    return normalized


def get_public_api_url() -> str:
    settings = get_settings()
    return _require_url(settings.public_api_url, "PUBLIC_API_URL")


def get_public_site_url() -> str:
    settings = get_settings()
    return _require_url(settings.public_site_url, "PUBLIC_SITE_URL")


class WhitepapperMcpTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        return mcp_token_service.load_access_token(token)


class WhitepapperMcpOAuthService:
    @staticmethod
    def _normalize_string_list(values: Iterable[str] | None, *, fallback: list[str]) -> list[str]:
        normalized: list[str] = []
        for value in values or []:
            item = str(value or "").strip()
            if not item or item in normalized:
                continue
            normalized.append(item)
        return normalized or list(fallback)

    @staticmethod
    def _validate_absolute_url(value: str, *, field_name: str) -> str:
        candidate = str(value or "").strip()
        parsed = urlparse(candidate)
        if not parsed.scheme:
            raise ValueError(f"{field_name} must be an absolute URI.")
        if parsed.scheme in {"http", "https"} and not parsed.netloc:
            raise ValueError(f"{field_name} must include a valid host.")
        if not parsed.netloc and not parsed.path:
            raise ValueError(f"{field_name} must be an absolute URI.")
        return candidate

    @staticmethod
    def validate_scopes(scopes: list[str] | None) -> list[str]:
        requested = [str(scope).strip() for scope in (scopes or ["mcp"]) if str(scope).strip()]
        if not requested:
            return ["mcp"]
        invalid_scopes = [scope for scope in requested if scope != "mcp"]
        if invalid_scopes:
            raise ValueError(f"Unsupported scope requested: {', '.join(invalid_scopes)}")
        return ["mcp"]

    def get_client(self, client_id: str) -> dict | None:
        normalized_client_id = str(client_id or "").strip()
        if not normalized_client_id:
            return None
        return firestore_store.get(MCP_OAUTH_CLIENTS_COLLECTION, normalized_client_id)

    def register_client(
        self,
        *,
        client_name: str | None,
        redirect_uris: list[str],
        grant_types: list[str] | None,
        token_endpoint_auth_method: str | None,
        response_types: list[str] | None,
        scope: str | None,
    ) -> dict[str, object]:
        normalized_auth_method = str(token_endpoint_auth_method or "none").strip() or "none"
        if normalized_auth_method != "none":
            raise ValueError("Only token_endpoint_auth_method=none is supported.")

        normalized_redirect_uris = self._normalize_string_list(redirect_uris, fallback=[])
        if not normalized_redirect_uris:
            raise ValueError("redirect_uris must contain at least one URL.")
        normalized_redirect_uris = [
            self._validate_absolute_url(uri, field_name="redirect_uris")
            for uri in normalized_redirect_uris
        ]

        normalized_grant_types = self._normalize_string_list(
            grant_types,
            fallback=["authorization_code", "refresh_token"],
        )
        if "authorization_code" not in normalized_grant_types:
            raise ValueError("grant_types must include authorization_code.")

        normalized_response_types = self._normalize_string_list(
            response_types,
            fallback=["code"],
        )
        if "code" not in normalized_response_types:
            raise ValueError("response_types must include code.")

        requested_scopes = [part for part in str(scope or "").split(" ") if part.strip()] or None
        validated_scopes = self.validate_scopes(requested_scopes)
        normalized_scope = " ".join(validated_scopes)

        client_id = str(uuid4())
        client_id_issued_at = int(time())
        now = utc_now()
        client_doc = {
            "clientId": client_id,
            "clientName": str(client_name or "").strip() or "Codex",
            "redirectUris": normalized_redirect_uris,
            "grantTypes": normalized_grant_types,
            "responseTypes": normalized_response_types,
            "tokenEndpointAuthMethod": normalized_auth_method,
            "scope": normalized_scope,
            "clientIdIssuedAt": client_id_issued_at,
            "createdAt": now,
            "updatedAt": now,
        }
        firestore_store.create(
            MCP_OAUTH_CLIENTS_COLLECTION,
            client_doc,
            doc_id=client_id,
        )
        return {
            "client_id": client_id,
            "client_name": client_doc["clientName"],
            "redirect_uris": normalized_redirect_uris,
            "grant_types": normalized_grant_types,
            "response_types": normalized_response_types,
            "token_endpoint_auth_method": normalized_auth_method,
            "scope": normalized_scope,
            "client_id_issued_at": client_id_issued_at,
        }

    def create_authorization_request(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        state: str | None,
        code_challenge: str,
        code_challenge_method: str = "S256",
        scopes: list[str] | None,
        resource: str | None = None,
    ) -> str:
        normalized_challenge_method = str(code_challenge_method or "S256").strip()
        if normalized_challenge_method not in {"S256", "plain"}:
            raise ValueError("Unsupported code_challenge_method requested.")

        normalized_redirect_uri = self._validate_absolute_url(
            redirect_uri,
            field_name="redirect_uri",
        )
        client_doc = self.get_client(client_id)
        client_name = str((client_doc or {}).get("clientName") or client_id).strip() or client_id
        if client_doc:
            allowed_redirect_uris = [
                str(item).strip()
                for item in client_doc.get("redirectUris") or []
                if str(item).strip()
            ]
            if normalized_redirect_uri not in allowed_redirect_uris:
                raise ValueError("redirect_uri is not registered for this client_id.")

        request_id = str(uuid4())
        now = utc_now()
        firestore_store.create(
            MCP_OAUTH_SESSIONS_COLLECTION,
            {
                "sessionId": request_id,
                "requestId": request_id,
                "status": "pending",
                "clientId": client_id,
                "clientName": client_name,
                "redirectUri": normalized_redirect_uri,
                "state": state,
                "scopes": self.validate_scopes(scopes),
                "codeChallenge": code_challenge,
                "codeChallengeMethod": normalized_challenge_method,
                "resource": resource,
                "createdAt": now,
                "requestExpiresAt": now + timedelta(seconds=MCP_AUTH_REQUEST_TTL_SECONDS),
            },
            doc_id=request_id,
        )
        return f"{get_public_site_url()}/mcp/connect?{urlencode({'request': request_id})}"

    def get_pending_request(self, request_id: str) -> dict | None:
        doc = firestore_store.get(MCP_OAUTH_SESSIONS_COLLECTION, request_id)
        if not doc:
            return None
        if str(doc.get("status") or "") != "pending":
            return None
        expires_at = doc.get("requestExpiresAt")
        if expires_at and expires_at <= utc_now():
            return None
        return doc

    def complete_authorization_request(self, *, request_id: str, user_id: str, project_id: str) -> str:
        request_doc = self.get_pending_request(request_id)
        if not request_doc:
            raise ValueError("Authorization request has expired.")

        code = f"wc_{uuid4().hex}{uuid4().hex}"
        now = utc_now()
        state = request_doc.get("state")
        redirect_uri = str(request_doc.get("redirectUri") or "").strip()
        firestore_store.update(
            MCP_OAUTH_SESSIONS_COLLECTION,
            request_id,
            {
                "status": "code_issued",
                "code": code,
                "userId": user_id,
                "projectId": project_id,
                "codeIssuedAt": now,
                "codeExpiresAt": now + timedelta(seconds=MCP_AUTH_CODE_TTL_SECONDS),
                "used": False,
            },
        )

        query = {"code": code}
        if state:
            query["state"] = str(state)
        return f"{redirect_uri}{'&' if '?' in redirect_uri else '?'}{urlencode(query)}"

    def load_authorization_code(self, *, code: str, client_id: str) -> dict | None:
        matches = firestore_store.find_by_fields(MCP_OAUTH_SESSIONS_COLLECTION, {"code": code})
        doc = matches[0] if matches else None
        if not doc:
            return None
        if str(doc.get("status") or "") != "code_issued":
            return None
        if bool(doc.get("used")):
            return None
        if str(doc.get("clientId") or "") != client_id:
            return None
        expires_at = doc.get("codeExpiresAt")
        if expires_at and expires_at <= utc_now():
            return None
        return doc

    def exchange_authorization_code(
        self,
        *,
        client_id: str,
        code: str,
        redirect_uri: str,
        code_verifier: str,
    ) -> OAuthToken:
        code_doc = self.load_authorization_code(code=code, client_id=client_id)
        if not code_doc:
            raise ValueError("Authorization code is invalid or expired.")

        expected_redirect_uri = str(code_doc.get("redirectUri") or "").strip()
        if redirect_uri != expected_redirect_uri:
            raise ValueError("redirect_uri did not match the one used when creating auth code")

        expected_challenge = str(code_doc.get("codeChallenge") or "")
        challenge_method = str(code_doc.get("codeChallengeMethod") or "S256").strip()
        if challenge_method == "S256":
            sha256 = hashlib.sha256(code_verifier.encode("utf-8")).digest()
            hashed_code_verifier = base64.urlsafe_b64encode(sha256).decode("utf-8").rstrip("=")
            if hashed_code_verifier != expected_challenge:
                raise ValueError("incorrect code_verifier")
        elif challenge_method == "plain":
            if code_verifier != expected_challenge:
                raise ValueError("incorrect code_verifier")
        else:
            raise ValueError("unsupported code_challenge_method")

        access_doc = mcp_token_service.create_access_token(
            user_id=str(code_doc.get("userId") or ""),
            project_id=str(code_doc.get("projectId") or ""),
            label=str(code_doc.get("clientName") or code_doc.get("clientId") or "").strip() or None,
            client_id=client_id,
            scopes=[str(item) for item in code_doc.get("scopes") or ["mcp"]],
        )
        session_id = str(code_doc.get("requestId") or code_doc.get("sessionId") or "").strip()
        if not session_id:
            raise ValueError("Authorization session is invalid.")
        # Keep only active auth data: once code is exchanged, session state is no longer needed.
        firestore_store.delete(MCP_OAUTH_SESSIONS_COLLECTION, session_id)
        return OAuthToken(
            access_token=str(access_doc["rawToken"]),
            scope=" ".join([str(item) for item in code_doc.get("scopes") or ["mcp"]]),
        )

    def cleanup_expired_oauth_data(self) -> int:
        now = utc_now()
        removed = 0

        sessions = firestore_store.list_all(MCP_OAUTH_SESSIONS_COLLECTION)
        for session in sessions:
            session_id = str(session.get("requestId") or session.get("sessionId") or "").strip()
            if not session_id:
                continue

            status = str(session.get("status") or "").strip().lower()
            expires_at = None
            if status == "pending":
                expires_at = session.get("requestExpiresAt")
            elif status == "code_issued":
                expires_at = session.get("codeExpiresAt")

            if expires_at and expires_at <= now:
                firestore_store.delete(MCP_OAUTH_SESSIONS_COLLECTION, session_id)
                removed += 1

        # One-time legacy cleanup for pre-refactor collections.
        for legacy_collection, id_key in (
            (LEGACY_MCP_OAUTH_REQUESTS_COLLECTION, "requestId"),
            (LEGACY_MCP_OAUTH_CODES_COLLECTION, "codeId"),
        ):
            legacy_items = firestore_store.list_all(legacy_collection)
            for item in legacy_items:
                doc_id = str(item.get(id_key) or "").strip()
                if not doc_id:
                    continue
                firestore_store.delete(legacy_collection, doc_id)
                removed += 1

        return removed


mcp_oauth_service = WhitepapperMcpOAuthService()
mcp_token_verifier = WhitepapperMcpTokenVerifier()
