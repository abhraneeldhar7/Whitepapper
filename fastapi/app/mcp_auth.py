from __future__ import annotations

import base64
import hashlib
import logging
import secrets
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, RedirectResponse
from fastmcp.server.auth import AccessToken
from mcp.server.auth.middleware.bearer_auth import AuthenticatedUser
from starlette.authentication import AuthCredentials
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.limits import MCP_TOKEN_LIMIT_PER_MONTH
from app.services.auth_service import get_verified_id
from app.services.mcp_auth import mcp_authorization_service
from app.services.user_service import user_service

MCP_HTTP_PREFIX = "/mcp"
logger = logging.getLogger(__name__)


@dataclass
class PendingAuthorization:
    request_id: str
    client_id: str
    client_name: str
    redirect_uri: str
    scopes: list[str]
    state: str | None
    code_challenge: str
    created_at: float


@dataclass
class PendingCode:
    code: str
    client_id: str
    client_name: str
    redirect_uri: str
    user_id: str
    scopes: list[str]
    code_challenge: str
    created_at: float


@dataclass
class RegisteredClient:
    client_id: str
    client_name: str
    redirect_uris: list[str]
    created_at: float


# In-memory OAuth state: intentional design choice. State is ephemeral — lost on restart,
# but acceptable since MCP tokens are re-authorizable. Avoids Redis dependency for auth flow.
_pending_authorizations: dict[str, PendingAuthorization] = {}
_pending_codes: dict[str, PendingCode] = {}
_registered_clients: dict[str, RegisteredClient] = {}


def _required_env(value: str | None, env_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise RuntimeError(f"{env_name} must be configured.")
    return normalized


def _oauth_register_url() -> str:
    return f"{_required_env(get_settings().public_api_url, 'PUBLIC_API_URL').rstrip('/')}/oauth/register"


def _oauth_authorize_url() -> str:
    return f"{_required_env(get_settings().public_api_url, 'PUBLIC_API_URL').rstrip('/')}/oauth/authorize"


def _oauth_token_url() -> str:
    return f"{_required_env(get_settings().public_api_url, 'PUBLIC_API_URL').rstrip('/')}/oauth/token"


def _json_no_cache(payload: Any, status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        jsonable_encoder(payload),
        status_code=status_code,
        headers={"Cache-Control": "no-store, no-cache"},
    )


async def _read_request_payload(request: Request) -> dict[str, Any]:
    content_type = str(request.headers.get("content-type") or "").lower()
    if "application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type:
        form = await request.form()
        payload: dict[str, Any] = {}
        for key in form.keys():
            values = form.getlist(key)
            payload[key] = values if len(values) > 1 else form.get(key)
        return payload

    try:
        body = await request.json()
    except Exception:
        body = {}
    return body if isinstance(body, dict) else {}


def _mcp_connection_payload() -> dict[str, Any]:
    endpoint_url = f"{_required_env(get_settings().public_api_url, 'PUBLIC_API_URL').rstrip('/')}{MCP_HTTP_PREFIX}"
    return {
        "serverName": "whitepapper",
        "transport": "http",
        "endpointUrl": endpoint_url,
        "manualConfig": {
            "servers": {
                "whitepapper": {
                    "url": endpoint_url,
                    "type": "http",
                }
            },
            "inputs": [],
        },
    }


def _normalize_redirect_uris(raw_value: Any) -> list[str]:
    if isinstance(raw_value, list):
        return [_validate_redirect_uri(str(item)) for item in raw_value if str(item).strip()]
    if isinstance(raw_value, str) and raw_value.strip():
        return [_validate_redirect_uri(raw_value)]
    return []


def _normalize_scope(scope_raw: str | None) -> list[str]:
    scopes = [item.strip() for item in str(scope_raw or "").split(" ") if item.strip()]
    if not scopes:
        return ["mcp"]
    return scopes


def _hash_pkce_verifier(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def _validate_redirect_uri(redirect_uri: str) -> str:
    resolved = str(redirect_uri or "").strip()
    if not resolved.startswith("http://") and not resolved.startswith("https://"):
        raise HTTPException(status_code=400, detail="redirect_uri must be an absolute URL.")
    return resolved


def _auth_error_response(detail: str, *, error: str = "invalid_token", status_code: int = 401) -> JSONResponse:
    body = {"error": error, "error_description": detail}
    response = _json_no_cache(body, status_code=status_code)
    response.headers["WWW-Authenticate"] = (
        'Bearer realm="whitepapper-mcp", '
        f'resource_metadata="{_required_env(get_settings().public_api_url, "PUBLIC_API_URL").rstrip("/")}/.well-known/oauth-protected-resource", '
        f'authorization_uri="{_oauth_authorize_url()}", '
        f'scope="mcp"'
    )
    return response


def _encode_redirect_params(params: dict[str, str | None]) -> str:
    return urlencode({key: value for key, value in params.items() if value is not None})


def _load_pending_authorization(request_id: str) -> PendingAuthorization:
    item = _pending_authorizations.get(request_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Authorization request not found or expired.")
    return item


def _load_pending_code(code: str) -> PendingCode:
    item = _pending_codes.get(code)
    if item is None:
        raise HTTPException(status_code=400, detail="Authorization code is invalid or expired.")
    return item


class McpBearerAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path.rstrip("/") != MCP_HTTP_PREFIX:
            return await call_next(request)

        header = str(request.headers.get("authorization") or "").strip()
        if not header.lower().startswith("bearer "):
            return _auth_error_response("Authentication required.")

        raw_token = header[7:].strip()
        if not raw_token:
            return _auth_error_response("Authentication required.")

        token_doc = mcp_authorization_service.get_token_by_hash(mcp_authorization_service.hash_token(raw_token))
        if token_doc is None:
            return _auth_error_response("Invalid MCP token.")

        access_token = AccessToken(
            token=raw_token,
            client_id=str(token_doc.get("tokenId") or ""),
            scopes=["mcp"],
            claims={"sub": str(token_doc.get("userId") or "")},
        )
        request.scope["auth"] = AuthCredentials(access_token.scopes)
        request.scope["user"] = AuthenticatedUser(access_token)
        return await call_next(request)


@lru_cache(maxsize=1)
def build_mcp_router() -> APIRouter:
    router = APIRouter(tags=["mcp"])

    async def oauth_protected_resource() -> JSONResponse:
        return _json_no_cache(
            {
                "resource": f"{_required_env(get_settings().public_api_url, 'PUBLIC_API_URL').rstrip('/')}{MCP_HTTP_PREFIX}",
                "authorization_servers": [_required_env(get_settings().public_api_url, "PUBLIC_API_URL").rstrip("/")],
                "scopes_supported": ["mcp"],
                "bearer_methods_supported": ["header"],
                "resource_name": "Whitepapper MCP",
            }
        )

    async def oauth_authorization_server() -> JSONResponse:
        return _json_no_cache(
            {
                "issuer": _required_env(get_settings().public_api_url, "PUBLIC_API_URL").rstrip("/"),
                "service_documentation": f"{_required_env(get_settings().public_site_url, 'PUBLIC_SITE_URL').rstrip('/')}/integrations",
                "authorization_endpoint": _oauth_authorize_url(),
                "token_endpoint": _oauth_token_url(),
                "registration_endpoint": _oauth_register_url(),
                "client_id_metadata_document_supported": False,
                "response_types_supported": ["code"],
                "response_modes_supported": ["query"],
                "grant_types_supported": ["authorization_code"],
                "token_endpoint_auth_methods_supported": ["none"],
                "code_challenge_methods_supported": ["S256"],
                "authorization_response_iss_parameter_supported": False,
                "scopes_supported": ["mcp"],
            }
        )

    async def openid_configuration() -> JSONResponse:
        return _json_no_cache(
            {
                "issuer": _required_env(get_settings().public_api_url, "PUBLIC_API_URL").rstrip("/"),
                "authorization_endpoint": _oauth_authorize_url(),
                "token_endpoint": _oauth_token_url(),
                "registration_endpoint": _oauth_register_url(),
                "client_id_metadata_document_supported": False,
                "response_types_supported": ["code"],
                "response_modes_supported": ["query"],
                "grant_types_supported": ["authorization_code"],
                "token_endpoint_auth_methods_supported": ["none"],
                "code_challenge_methods_supported": ["S256"],
                "authorization_response_iss_parameter_supported": False,
                "scopes_supported": ["mcp"],
                "subject_types_supported": ["public"],
                "id_token_signing_alg_values_supported": ["RS256"],
            }
        )

    async def oauth_register(request: Request) -> JSONResponse:
        payload = await _read_request_payload(request)
        client_name = str(payload.get("client_name") or payload.get("agent_name") or "MCP Client").strip()
        client_id = f"wpmcp_client_{secrets.token_urlsafe(12)}"
        redirect_uris = _normalize_redirect_uris(payload.get("redirect_uris"))
        _registered_clients[client_id] = RegisteredClient(
            client_id=client_id,
            client_name=client_name or "MCP Client",
            redirect_uris=redirect_uris,
            created_at=time.time(),
        )
        logger.info("MCP OAuth register request received for client_name=%s redirect_uris=%s", client_name, redirect_uris)
        return _json_no_cache(
            {
                "client_id": client_id,
                "client_id_issued_at": int(time.time()),
                "client_name": client_name,
                "client_uri": payload.get("client_uri") or "https://code.visualstudio.com",
                "redirect_uris": redirect_uris,
                "grant_types": ["authorization_code"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
                "client_secret_expires_at": 0,
            },
            status_code=201,
        )

    async def oauth_authorize(
        client_id: str,
        redirect_uri: str,
        code_challenge: str,
        code_challenge_method: str,
        scope: str | None = None,
        state: str | None = None,
        client_name: str | None = None,
    ) -> RedirectResponse:
        if str(code_challenge_method or "").strip().upper() != "S256":
            raise HTTPException(status_code=400, detail="Only S256 PKCE is supported.")

        registered_client = _registered_clients.get(str(client_id).strip())
        resolved_redirect_uri = _validate_redirect_uri(redirect_uri)
        if registered_client and registered_client.redirect_uris and resolved_redirect_uri not in registered_client.redirect_uris:
            raise HTTPException(status_code=400, detail="redirect_uri is not registered for this client.")

        resolved_client_name = (
            str(client_name or "").strip()
            or (registered_client.client_name if registered_client else "")
            or str(client_id).strip()
        )

        logger.info(
            "MCP OAuth authorize request received for client_id=%s redirect_uri=%s client_name=%s",
            str(client_id).strip(),
            resolved_redirect_uri,
            resolved_client_name,
        )

        request_id = secrets.token_urlsafe(24)
        _pending_authorizations[request_id] = PendingAuthorization(
            request_id=request_id,
            client_id=str(client_id).strip(),
            client_name=resolved_client_name,
            redirect_uri=resolved_redirect_uri,
            scopes=_normalize_scope(scope),
            state=str(state).strip() or None,
            code_challenge=str(code_challenge).strip(),
            created_at=time.time(),
        )

        consent_url = f"{_required_env(get_settings().public_site_url, 'PUBLIC_SITE_URL').rstrip('/')}/mcp/connect?request_id={request_id}"
        return RedirectResponse(url=consent_url, status_code=302)

    @router.get("/oauth/consent/context")
    async def get_oauth_consent_context(
        request_id: str,
        user_id: str = Depends(get_verified_id),
    ) -> JSONResponse:
        pending = _load_pending_authorization(request_id)
        user_doc = user_service.get_by_id(user_id)
        return _json_no_cache(
            {
                "requestId": pending.request_id,
                "clientId": pending.client_id,
                "clientName": pending.client_name,
                "redirectUri": pending.redirect_uri,
                "scopes": pending.scopes,
                "user": {
                    "displayName": user_doc.get("displayName"),
                    "username": user_doc.get("username"),
                    "email": user_doc.get("email"),
                    "avatarUrl": user_doc.get("avatarUrl"),
                },
            }
        )

    @router.post("/oauth/consent/complete")
    async def complete_oauth_consent(
        payload: dict[str, str],
        user_id: str = Depends(get_verified_id),
    ) -> JSONResponse:
        request_id = str(payload.get("requestId") or "").strip()
        action = str(payload.get("action") or "approve").strip().lower()
        if not request_id:
            raise HTTPException(status_code=400, detail="requestId is required.")
        if action not in {"approve", "deny"}:
            raise HTTPException(status_code=400, detail="action must be approve or deny.")

        pending = _load_pending_authorization(request_id)
        del _pending_authorizations[request_id]

        if action == "deny":
            separator = "&" if "?" in pending.redirect_uri else "?"
            redirect_to = f"{pending.redirect_uri}{separator}{_encode_redirect_params({'error': 'access_denied', 'state': pending.state})}"
            return _json_no_cache({"redirectTo": redirect_to})

        code = secrets.token_urlsafe(32)
        _pending_codes[code] = PendingCode(
            code=code,
            client_id=pending.client_id,
            client_name=pending.client_name,
            redirect_uri=pending.redirect_uri,
            user_id=user_id,
            scopes=pending.scopes,
            code_challenge=pending.code_challenge,
            created_at=time.time(),
        )

        params = {"code": code}
        if pending.state:
            params["state"] = pending.state
        separator = "&" if "?" in pending.redirect_uri else "?"
        return _json_no_cache({"redirectTo": f"{pending.redirect_uri}{separator}{urlencode(params)}"})

    async def oauth_token(request: Request) -> JSONResponse:
        payload = await _read_request_payload(request)
        grant_type = str(payload.get("grant_type") or "").strip()
        if grant_type != "authorization_code":
            raise HTTPException(status_code=400, detail="Only authorization_code is supported.")

        code = str(payload.get("code") or "").strip()
        client_id = str(payload.get("client_id") or "").strip()
        redirect_uri = _validate_redirect_uri(str(payload.get("redirect_uri") or "").strip())
        code_verifier = str(payload.get("code_verifier") or "").strip()
        logger.info("MCP OAuth token exchange received for client_id=%s redirect_uri=%s", client_id, redirect_uri)

        pending_code = _load_pending_code(code)
        if client_id != pending_code.client_id:
            raise HTTPException(status_code=400, detail="client_id does not match the authorization code.")
        if redirect_uri != pending_code.redirect_uri:
            raise HTTPException(status_code=400, detail="redirect_uri does not match the authorization code.")
        if _hash_pkce_verifier(code_verifier) != pending_code.code_challenge:
            raise HTTPException(status_code=400, detail="PKCE verification failed.")

        del _pending_codes[code]
        raw_token, _ = mcp_authorization_service.issue_token(
            user_id=pending_code.user_id,
            agent_name=pending_code.client_name,
        )

        return _json_no_cache(
            {
                "access_token": raw_token,
                "token_type": "Bearer",
                "scope": " ".join(pending_code.scopes),
            }
        )

    router.add_api_route(
        "/.well-known/oauth-protected-resource",
        oauth_protected_resource,
        methods=["GET"],
    )
    router.add_api_route(
        "/.well-known/oauth-authorization-server",
        oauth_authorization_server,
        methods=["GET"],
    )
    router.add_api_route(
        "/.well-known/openid-configuration",
        openid_configuration,
        methods=["GET"],
    )
    router.add_api_route("/oauth/register", oauth_register, methods=["POST"])
    router.add_api_route("/oauth/authorize", oauth_authorize, methods=["GET"])
    router.add_api_route("/oauth/token", oauth_token, methods=["POST"])

    @router.get(f"{MCP_HTTP_PREFIX}/config")
    async def get_mcp_connection_info() -> JSONResponse:
        return _json_no_cache(_mcp_connection_payload())

    @router.get(f"{MCP_HTTP_PREFIX}/authorizations")
    async def list_mcp_authorizations(user_id: str = Depends(get_verified_id)) -> JSONResponse:
        usage_doc = mcp_authorization_service.get_user_usage(user_id)
        authorizations = [
            {
                "authorizationId": item.get("tokenId"),
                "agentName": item.get("agentName"),
                "createdAt": item.get("created_at"),
            }
            for item in mcp_authorization_service.list_tokens_for_user(user_id)
        ]
        return _json_no_cache(
            {
                "authorizations": authorizations,
                "usage": int(usage_doc.get("usage", 0)),
                "limitPerMonth": int(usage_doc.get("limitPerMonth", MCP_TOKEN_LIMIT_PER_MONTH)),
            }
        )

    @router.delete(f"{MCP_HTTP_PREFIX}/authorizations/{{authorization_id}}")
    async def revoke_mcp_authorization(authorization_id: str, user_id: str = Depends(get_verified_id)) -> JSONResponse:
        if not mcp_authorization_service.revoke_token(user_id, authorization_id):
            raise HTTPException(status_code=404, detail="MCP authorization not found.")
        return _json_no_cache({"ok": True})

    return router
