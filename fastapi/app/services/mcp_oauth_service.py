from __future__ import annotations

from datetime import timedelta
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

from mcp.server.auth.provider import (
    AccessToken,
    AuthorizationCode,
    AuthorizationParams,
    AuthorizeError,
    OAuthAuthorizationServerProvider,
    OAuthClientInformationFull,
    OAuthToken,
    RefreshToken,
    TokenError,
    TokenVerifier,
)

from app.core.config import get_settings
from app.core.limits import (
    MCP_AUTH_CODE_TTL_SECONDS,
    MCP_AUTH_REQUEST_TTL_SECONDS,
    MCP_TOKEN_TTL_SECONDS,
)
from app.core.firestore_store import firestore_store, utc_now
from app.utils.mcp_auth import mcp_token_service

MCP_OAUTH_CLIENTS_COLLECTION = "mcp_oauth_clients"
MCP_OAUTH_REQUESTS_COLLECTION = "mcp_oauth_requests"
MCP_OAUTH_CODES_COLLECTION = "mcp_oauth_codes"


def _require_url(value: str | None, env_name: str) -> str:
    normalized = str(value or "").strip().rstrip("/")
    if not normalized:
        raise RuntimeError(f"{env_name} must be configured for MCP OAuth.")
    return normalized


def get_public_api_url() -> str:
    settings = get_settings()
    return _require_url(settings.public_api_url, "PUBLIC_API_URL")


def get_configured_public_api_url() -> str | None:
    settings = get_settings()
    value = str(settings.public_api_url or "").strip().rstrip("/")
    return value or None


def get_public_site_url() -> str:
    settings = get_settings()
    return _require_url(settings.public_site_url, "PUBLIC_SITE_URL")


class WhitepapperMcpTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        return mcp_token_service.load_access_token(token)


class WhitepapperMcpOAuthProvider(
    OAuthAuthorizationServerProvider[AuthorizationCode, RefreshToken, AccessToken]
):
    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        doc = firestore_store.get(MCP_OAUTH_CLIENTS_COLLECTION, client_id)
        if not doc:
            return None
        return OAuthClientInformationFull.model_validate(doc)

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        client_id = str(client_info.client_id or "").strip()
        if not client_id:
            raise ValueError("client_id is required.")
        payload = client_info.model_dump(mode="json")
        payload["updatedAt"] = utc_now()
        if not firestore_store.get(MCP_OAUTH_CLIENTS_COLLECTION, client_id):
            payload["createdAt"] = utc_now()
        firestore_store.update(MCP_OAUTH_CLIENTS_COLLECTION, client_id, payload)

    async def authorize(self, client: OAuthClientInformationFull, params: AuthorizationParams) -> str:
        if not client.client_id:
            raise AuthorizeError("invalid_client", "Client is not registered.")
        request_id = str(uuid4())
        now = utc_now()
        firestore_store.create(
            MCP_OAUTH_REQUESTS_COLLECTION,
            {
                "requestId": request_id,
                "clientId": client.client_id,
                "clientName": client.client_name or client.client_id,
                "redirectUri": str(params.redirect_uri),
                "redirectUriProvidedExplicitly": params.redirect_uri_provided_explicitly,
                "state": params.state,
                "scopes": list(params.scopes or ["mcp"]),
                "codeChallenge": params.code_challenge,
                "resource": params.resource,
                "createdAt": now,
                "expiresAt": now + timedelta(seconds=MCP_AUTH_REQUEST_TTL_SECONDS),
            },
            doc_id=request_id,
        )
        query = urlencode({"request": request_id})
        return f"{get_public_site_url()}/mcp/connect?{query}"

    async def load_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: str,
    ) -> AuthorizationCode | None:
        matches = firestore_store.find_by_fields(MCP_OAUTH_CODES_COLLECTION, {"code": authorization_code})
        doc = matches[0] if matches else None
        if not doc:
            return None
        if str(doc.get("clientId") or "") != str(client.client_id or ""):
            return None
        if bool(doc.get("used")):
            return None
        expires_at = doc.get("expiresAt")
        if expires_at and expires_at <= utc_now():
            return None
        return AuthorizationCode(
            code=str(doc.get("code") or ""),
            scopes=[str(item) for item in doc.get("scopes") or ["mcp"]],
            expires_at=float(expires_at.timestamp()) if expires_at else float(utc_now().timestamp()),
            client_id=str(doc.get("clientId") or ""),
            code_challenge=str(doc.get("codeChallenge") or ""),
            redirect_uri=str(doc.get("redirectUri") or ""),
            redirect_uri_provided_explicitly=bool(doc.get("redirectUriProvidedExplicitly", True)),
            resource=doc.get("resource"),
        )

    async def exchange_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: AuthorizationCode,
    ) -> OAuthToken:
        matches = firestore_store.find_by_fields(MCP_OAUTH_CODES_COLLECTION, {"code": authorization_code.code})
        doc = matches[0] if matches else None
        if not doc:
            raise ValueError("Authorization code not found.")
        if bool(doc.get("used")):
            raise TokenError("invalid_grant", "Authorization code already used.")

        workspace_id = str(doc.get("workspaceId") or uuid4())
        label = str(doc.get("label") or client.client_name or client.client_id or "").strip() or None
        access_doc = mcp_token_service.create_access_token(
            user_id=str(doc.get("userId") or ""),
            project_id=str(doc.get("projectId") or ""),
            workspace_id=workspace_id,
            label=label,
            client_id=str(client.client_id or ""),
            scopes=[str(item) for item in doc.get("scopes") or ["mcp"]],
        )
        refresh_doc = mcp_token_service.create_refresh_token(
            user_id=str(doc.get("userId") or ""),
            project_id=str(doc.get("projectId") or ""),
            workspace_id=workspace_id,
            client_id=str(client.client_id or ""),
            scopes=[str(item) for item in doc.get("scopes") or ["mcp"]],
            label=label,
        )
        firestore_store.update(
            MCP_OAUTH_CODES_COLLECTION,
            str(doc.get("codeId") or ""),
            {
                "used": True,
                "workspaceId": workspace_id,
                "tokenId": access_doc.get("tokenId"),
                "refreshTokenId": refresh_doc.get("refreshTokenId"),
                "label": label,
            },
        )
        return OAuthToken(
            access_token=str(access_doc["rawToken"]),
            expires_in=MCP_TOKEN_TTL_SECONDS,
            refresh_token=str(refresh_doc["rawToken"]),
            scope=" ".join([str(item) for item in doc.get("scopes") or ["mcp"]]),
        )

    async def load_refresh_token(self, client: OAuthClientInformationFull, refresh_token: str) -> RefreshToken | None:
        doc = mcp_token_service.load_refresh_token(refresh_token)
        if not doc:
            return None
        if str(doc.get("clientId") or "") != str(client.client_id or ""):
            return None
        expires_at = doc.get("expiresAt")
        expires_unix = int(expires_at.timestamp()) if expires_at else None
        return RefreshToken(
            token=refresh_token,
            client_id=str(doc.get("clientId") or ""),
            scopes=[str(item) for item in doc.get("scopes") or ["mcp"]],
            expires_at=expires_unix,
        )

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        refresh_doc = mcp_token_service.load_refresh_token(refresh_token.token)
        if not refresh_doc:
            raise TokenError("invalid_grant", "Refresh token is invalid.")
        requested_scopes = scopes or [str(item) for item in refresh_doc.get("scopes") or ["mcp"]]
        access_doc = mcp_token_service.create_access_token(
            user_id=str(refresh_doc.get("userId") or ""),
            project_id=str(refresh_doc.get("projectId") or ""),
            workspace_id=str(refresh_doc.get("workspaceId") or uuid4()),
            label=str(refresh_doc.get("label") or client.client_name or client.client_id or "").strip() or None,
            client_id=str(client.client_id or ""),
            scopes=requested_scopes,
        )
        next_refresh_doc = mcp_token_service.create_refresh_token(
            user_id=str(refresh_doc.get("userId") or ""),
            project_id=str(refresh_doc.get("projectId") or ""),
            workspace_id=str(refresh_doc.get("workspaceId") or uuid4()),
            client_id=str(client.client_id or ""),
            scopes=requested_scopes,
            label=str(refresh_doc.get("label") or client.client_name or client.client_id or "").strip() or None,
        )
        mcp_token_service.revoke_refresh_token_doc(refresh_doc)
        return OAuthToken(
            access_token=str(access_doc["rawToken"]),
            expires_in=MCP_TOKEN_TTL_SECONDS,
            refresh_token=str(next_refresh_doc["rawToken"]),
            scope=" ".join(requested_scopes),
        )

    async def load_access_token(self, token: str) -> AccessToken | None:
        return mcp_token_service.load_access_token(token)

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:
        raw_token = str(token.token or "").strip()
        if not raw_token:
            return
        access_doc = mcp_token_service.resolve_token_doc(raw_token)
        if access_doc:
            token_id = str(access_doc.get("tokenId") or "").strip()
            if token_id:
                mcp_token_service.revoke_mcp_token(token_id)
            return
        refresh_doc = mcp_token_service.load_refresh_token(raw_token)
        if refresh_doc:
            mcp_token_service.revoke_refresh_token_doc(refresh_doc)

    def get_pending_request(self, request_id: str) -> dict | None:
        doc = firestore_store.get(MCP_OAUTH_REQUESTS_COLLECTION, request_id)
        if not doc:
            return None
        expires_at = doc.get("expiresAt")
        if expires_at and expires_at <= utc_now():
            return None
        return doc

    def complete_authorization_request(self, *, request_id: str, user_id: str, project_id: str) -> str:
        request_doc = self.get_pending_request(request_id)
        if not request_doc:
            raise ValueError("Authorization request has expired.")

        code = f"wc_{uuid4().hex}{uuid4().hex}"
        code_id = str(uuid4())
        now = utc_now()
        state = request_doc.get("state")
        redirect_uri = str(request_doc.get("redirectUri") or "").strip()
        firestore_store.create(
            MCP_OAUTH_CODES_COLLECTION,
            {
                "codeId": code_id,
                "code": code,
                "clientId": request_doc.get("clientId"),
                "userId": user_id,
                "projectId": project_id,
                "workspaceId": str(uuid4()),
                "redirectUri": redirect_uri,
                "redirectUriProvidedExplicitly": bool(request_doc.get("redirectUriProvidedExplicitly", True)),
                "codeChallenge": request_doc.get("codeChallenge"),
                "resource": request_doc.get("resource"),
                "scopes": list(request_doc.get("scopes") or ["mcp"]),
                "label": request_doc.get("clientName"),
                "createdAt": now,
                "expiresAt": now + timedelta(seconds=MCP_AUTH_CODE_TTL_SECONDS),
                "used": False,
            },
            doc_id=code_id,
        )
        firestore_store.delete(MCP_OAUTH_REQUESTS_COLLECTION, request_id)

        query = {"code": code}
        if state:
            query["state"] = str(state)
        return f"{redirect_uri}{'&' if '?' in redirect_uri else '?'}{urlencode(query)}"


mcp_oauth_provider = WhitepapperMcpOAuthProvider()
mcp_token_verifier = WhitepapperMcpTokenVerifier()
