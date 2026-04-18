# Whitepapper MCP — Implementation Reference

This document explains how the Model Context Protocol (MCP) server is implemented inside the Whitepapper FastAPI backend, end-to-end.

---

## What is MCP here?

Whitepapper exposes a **streamable HTTP MCP server** so that AI coding assistants (Cursor, VS Code Copilot, Claude Desktop, etc.) can connect to a user's project, read its structure, and create or update content directly from the IDE.

The server is mounted at `/mcp` inside the existing FastAPI app. There is no separate process or service.

---

## High-level architecture

```
IDE / MCP client
      │
      │ HTTP (streamable-http transport)
      ▼
Cloudflare Worker  ─── reverse proxy / no-cache ──►  FastAPI (Cloud Run)
                                                            │
                                          ┌─────────────────┴──────────────────┐
                                          │                                    │
                                    FastMCP server                       Regular API routes
                                    (mounted at /mcp)                  (/projects, /papers, …)
                                          │
                                ┌─────────┴──────────┐
                                │                    │
                              Tools               Resources
                         (content CRUD)      (project context)
                                │
                         MCP token auth
                         (Firestore + Redis)
```

The MCP server is built with **[FastMCP](https://github.com/jlowin/fastmcp)** (`mcp.server.fastmcp.FastMCP`) and mounted as a sub-application inside FastAPI. All MCP traffic (`/mcp/*`) and OAuth discovery traffic (`/.well-known/*`) share the same Cloud Run instance as the rest of the API.

---

## File map

| File | Purpose |
|---|---|
| `fastapi/app/mcp_server.py` | MCP server definition: tools, resources, OAuth endpoints, router |
| `fastapi/app/services/mcp_oauth_service.py` | OAuth 2.0 PKCE service: client registration, auth codes, token exchange |
| `fastapi/app/services/mcp_auth.py` | Token storage, caching (Redis), usage tracking, revocation |
| `fastapi/app/main.py` | FastAPI app setup: mounts MCP app, registers middleware and routers |
| `astro/src/pages/mcp/connect.astro` | Browser consent page (Astro shell) |
| `astro/src/components/mcp/McpConnectPage.tsx` | React consent UI |
| `astro/src/lib/api/mcp.ts` | Frontend API calls for MCP OAuth flows |

---

## Transport: Streamable HTTP

The MCP transport used is **streamable HTTP** (the `mcp` spec's HTTP+SSE hybrid). FastMCP exposes a `streamable_http_app()` method that returns a standard ASGI app. That app is:

1. Built once via `_build_mcp_server().streamable_http_app()` (cached with `@lru_cache`).
2. Mounted into FastAPI at `/mcp`:

```python
# fastapi/app/main.py
app.mount("/mcp", build_mcp_app())
```

The FastMCP session manager is initialised inside a FastAPI lifespan context so its internal task group is alive for the full server lifetime:

```python
@asynccontextmanager
async def lifespan(_: FastAPI):
    build_mcp_app()
    async with get_mcp_session_manager().run():
        yield
```

---

## OAuth 2.0 PKCE authentication flow

Every tool call is authenticated. The MCP server uses **OAuth 2.0 Authorization Code + PKCE** to issue bearer tokens scoped to a single Whitepapper project. Tokens never expire (they are revoked explicitly). Monthly usage is capped at 10 000 tool calls per project.

### Step 1 — Client registration (`POST /mcp/register`)

An MCP client that does not already have a `client_id` calls the dynamic client registration endpoint. The backend stores the client in Firestore (`mcp_oauth_clients` collection) and returns a `client_id`. Only `token_endpoint_auth_method=none` (public clients) and `grant_type=authorization_code` are accepted.

### Step 2 — Authorization request (`GET /mcp/authorize`)

The MCP client redirects the browser to `/mcp/authorize` with standard PKCE parameters:

| Param | Required | Notes |
|---|---|---|
| `response_type` | yes | must be `code` |
| `client_id` | yes | registered client |
| `redirect_uri` | yes | must match registered URI |
| `code_challenge` | yes | PKCE challenge (S256 or plain) |
| `code_challenge_method` | no | defaults to S256 |
| `scope` | no | only `mcp` is accepted |
| `state` | no | opaque, echoed back |
| `resource` | no | resource indicator (RFC 8707) |

The backend:
1. Validates all parameters.
2. Creates an **authorization session** document in Firestore (`mcp_oauth_sessions`) with a 10-minute TTL.
3. Redirects the browser to the **Whitepapper frontend** consent page at `{PUBLIC_SITE_URL}/mcp/connect?request={session_id}`.

`POST /mcp/authorize` is also accepted; form fields are internally re-routed to the `GET` handler.

### Step 3 — Browser consent page (`/mcp/connect`)

The React page (`McpConnectPage.tsx`):
1. Reads the `?request=` query parameter.
2. Calls `GET /mcp/oauth/request/{request_id}` (public, no auth) to load the pending request summary (client name, requested scopes).
3. Loads the signed-in user's owned projects via `GET /projects`.
4. If the user is not signed in, shows a "Log in" prompt that returns to the same URL after login.
5. The user selects a project and clicks **Connect**.
6. Calls `POST /mcp/oauth/complete` (Clerk auth required) with `{ requestId, projectId }`.

### Step 4 — Authorization completion (`POST /mcp/oauth/complete`)

The backend:
1. Verifies the Clerk JWT of the signed-in user.
2. Confirms the user owns the chosen project.
3. Generates an opaque authorization code (`wc_<uuid><uuid>`).
4. Updates the Firestore session document to `status: code_issued` with a 10-minute code TTL.
5. Redirects the browser back to `redirect_uri?code=...&state=...`.

### Step 5 — Token exchange (`POST /mcp/token`)

The MCP client sends a form-encoded body:

| Field | Notes |
|---|---|
| `grant_type` | `authorization_code` |
| `client_id` | the registered client |
| `code` | the authorization code |
| `redirect_uri` | must match the original |
| `code_verifier` | PKCE verifier (validated against stored challenge) |

The backend:
1. Loads the session by code value via a Firestore field query.
2. Validates the `code_verifier` against the stored `code_challenge` (SHA-256 for S256, direct compare for plain).
3. Calls `mcp_token_service.create_access_token(...)`, which:
   - Generates a raw bearer token (`mcp_<uuid><uuid>`).
   - Stores `{ tokenId, tokenHash (SHA-256), userId, projectId, scopes, … }` in Firestore (`mcp_tokens`).
   - Writes the document to Redis cache for fast lookup (1-hour TTL).
4. Deletes the consumed session document from Firestore.
5. Returns `{ access_token, scope }`.

---

## Token verification on every tool call

`WhitepapperMcpTokenVerifier` is passed to `FastMCP` at construction time. FastMCP calls `verify_token(raw_token)` on every authenticated request.

```
raw_token
   │
   ▼
SHA-256 hash
   │
   ▼
Redis cache lookup  ──hit──►  return doc
   │ miss
   ▼
Firestore field query (tokenHash == hash)
   │
   ▼
write doc to Redis cache
   │
   ▼
check: revoked == false
       AND monthly usage < 10 000
   │
   ▼
return AccessToken(token, client_id, scopes)
```

Each successful tool call also increments the per-project monthly usage counter in Firestore atomically (via `firestore_store.increment`).

---

## Discovery endpoints

MCP clients that support RFC 9728 (OAuth 2.0 Protected Resource Metadata) and RFC 8414 (OAuth 2.0 Authorization Server Metadata) use `/.well-known` endpoints to discover auth endpoints automatically. Whitepapper serves all variants:

| Endpoint | Description |
|---|---|
| `GET /.well-known/oauth-authorization-server` | Root-issuer authorization server metadata |
| `GET /.well-known/openid-configuration` | Same payload, OpenID Connect alias |
| `GET /.well-known/oauth-protected-resource` | Protected resource metadata (RFC 9728) |
| `GET /.well-known/oauth-authorization-server/mcp` | Path-scoped auth server metadata |
| `GET /.well-known/openid-configuration/mcp` | Path-scoped OpenID alias |
| `GET /.well-known/oauth-protected-resource/mcp` | Path-scoped protected resource metadata |
| `GET /mcp/.well-known/oauth-authorization-server` | Prefix-scoped auth server metadata |
| `GET /mcp/.well-known/oauth-protected-resource` | Prefix-scoped protected resource metadata |
| `GET /mcp/.well-known/openid-configuration` | Prefix-scoped OpenID alias |
| `GET /mcp/config` | Human-readable connection payload (server URL + manual config JSON) |

All discovery responses include `Cache-Control: no-store, no-cache`.

---

## Middleware

### `McpAuthChallengeCompatibilityMiddleware`

FastMCP returns a standard `WWW-Authenticate: Bearer realm=...` header on 401 responses. Some MCP clients additionally require `authorization_uri`, `resource`, and `scope` parameters in the challenge. This middleware intercepts any 401 on a `/mcp` path and appends those parameters if they are absent, ensuring maximum client compatibility.

### `no_cache_mcp` HTTP middleware

All responses from paths starting with `/mcp` or `/.well-known` get `Cache-Control: no-store, no-cache` appended. This prevents the Cloudflare Worker (which caches GET responses by default) from caching any auth or MCP session data.

---

## FastMCP server definition

The MCP server is built inside `_build_mcp_server()` (cached with `@lru_cache`) and configured with:

- **Name**: `whitepapper`
- **Instructions**: A detailed system prompt instructing the connected AI how to use the tools, routing content to collections, following SEO rules, and avoiding redundant tool calls.
- **Token verifier**: `WhitepapperMcpTokenVerifier`
- **Auth settings**: `AuthSettings` pointing to `/mcp` as the issuer and resource server, with client registration disabled (clients use the `/mcp/register` endpoint directly instead).
- **Transport security**: DNS rebinding protection disabled (requests arrive through Cloudflare → Cloud Run where the `Host` header may be rewritten to an internal upstream domain; strict host validation would cause false 421 responses).

---

## Tools

Each tool resolves the calling user and project from the bearer token via `_require_tool_context()` before doing any work. Tools never accept a `project_id` argument — the project is always derived from the token so one token can only access one project.

| Tool | Description |
|---|---|
| `get_project_context` | Returns the full project structure: description, content guidelines, all collections with descriptions, all paper titles per collection, standalone papers. Intended to be called once per session. |
| `get_project` | Returns project fields (name, slug, description, etc.). |
| `update_project` | Updates project fields (name, slug, description, content guidelines, logo URL). |
| `set_project_visibility` | Toggles project public/private (propagates to all content). |
| `delete_project` | Permanently deletes the project. Requires `confirm=true`. |
| `update_project_description` | Overwrites the markdown project description only. |
| `get_paper` | Fetches the full markdown body and SEO fields of a single paper by ID. |
| `create_paper` | Creates a new paper. Validates slug uniqueness. Optionally accepts `seo_title`, `seo_description`, and `metadata`. Resolves `collection_id` by ID, slug, or exact name. |
| `update_paper` | Updates an existing paper. Only passed fields are changed. Supports content, slug, collection, status, and SEO fields. |
| `delete_paper` | Permanently deletes a paper. |
| `get_collection` | Gets a collection by ID, slug, or exact name. |
| `create_collection` | Creates a new collection. Requires a non-empty one-sentence description. Idempotent: if a collection with the same normalized name already exists it returns that collection. |
| `update_collection` | Updates a collection name, slug, description, or visibility. |
| `set_collection_visibility` | Toggles collection public/private. |
| `delete_collection` | Permanently deletes a collection and all its papers. Requires `confirm=true`. |

---

## Resources

| URI | Description |
|---|---|
| `whitepapper://project/context` | The same data as `get_project_context` but exposed as a named MCP resource for clients that prefer resource reads over tool calls. Returns JSON. |

---

## Token management API

These endpoints are used by the Whitepapper dashboard, not by MCP clients directly.

| Endpoint | Description |
|---|---|
| `GET /projects/{projectId}/mcp-tokens` | Lists all active MCP tokens for a project (Clerk auth required, owner only). Returns token ID, label, creation time, monthly usage, and usage limit. |
| `DELETE /projects/{projectId}/mcp-tokens/{tokenId}` | Revokes and deletes a token. Also cleans up any expired OAuth session documents. |

---

## Data storage

| Collection (Firestore) | Contents |
|---|---|
| `mcp_tokens` | Token documents (`docKind: "token"`) and per-project monthly usage counters (`docKind: "usage"`). Both live in the same collection separated by `docKind`. |
| `mcp_oauth_clients` | Registered OAuth clients (client ID, redirect URIs, grant types). |
| `mcp_oauth_sessions` | OAuth authorization sessions in flight. Cleaned up after code exchange or expiry. |

Redis is used as a write-through cache for token documents (1-hour TTL, keyed by SHA-256 hash of the raw token).

---

## Rate limits

| Limit | Value |
|---|---|
| MCP tool calls per project per month | 10 000 |
| Authorization request TTL | 10 minutes |
| Authorization code TTL | 10 minutes |
| Token expiry | None (tokens are permanent until revoked) |

---

## Manual connection (no browser flow)

For scripting or testing without the browser OAuth flow, project owners can generate a raw API key from the project dashboard settings and use it directly. The `/dev/projects` read-only endpoint accepts `x-api-key` but is not part of the MCP surface.

For the MCP server specifically, a raw MCP bearer token can be inserted directly into a client configuration. Replace the URL with the production API URL or `http://127.0.0.1:8000` when running locally:

```json
{
  "servers": {
    "whitepapper": {
      "type": "http",
      "url": "https://api.whitepapper.antk.in/mcp",
      "headers": {
        "Authorization": "Bearer mcp_YOUR_TOKEN"
      }
    }
  }
}
```
