# Whitepapper MCP Build Plan

## Decisions locked in

- MCP uses its own token (`mcp_` prefixed), separate from dev API key
- Token is shown to user once on generation, only the hashed version is stored in Firestore (same pattern as dev API key)
- Clerk is already registered and verified with Google — no OAuth consent screen setup needed
- Astro UI uses shadcn components only, no custom Tailwind formatting
- No live preview feature

---



## Firestore schema changes
make sure the schemas are consistent in astro and fastapi app.


### New collection — `mcp_tokens`

```
mcp_tokens/{token_id}
  token_hash: string        ← sha256 of the actual token
  user_id: string           ← Clerk user ID
  project_id: string
  workspace_id: string      ← random ID generated at token creation
  created_at: timestamp
  expires_at: timestamp     ← 90 days from creation
  revoked: bool             ← false by default
  label: string             ← optional, e.g. "Cursor - payments-sdk"
```


## Section 1 — MCP token utilities (Python, no endpoints yet)

File: `utils/mcp_auth.py`

Write these four functions. No endpoints, just pure utility functions that other parts of the code will call.

**`generate_mcp_token(user_id, project_id) → str`**
- exactly like dev api
- Return the plain token string — this is the only time it exists in plain form

**`resolve_mcp_token(plain_token) → dict | None`**
- exactly like dev api
- If `revoked == true` or `expires_at` is in the past, return None
- Return `{ user_id, project_id, workspace_id }`

**`revoke_mcp_token(token_id)`**
- Set `revoked = true` on the document

**`list_mcp_tokens_for_user(user_id) → list`**
- Query all non-revoked tokens for a user
- Return `[ { token_id, project_id, workspace_id, label, created_at, expires_at } ]`
- Used by the dashboard to show active connections

Like dev api, maintain usage: make it 10000 for now. track and sync the usage just like dev api.

---

## Section 2 — OAuth endpoints (FastAPI)

These three endpoints handle the browser-based auth flow the IDE triggers on first connection.

**`GET /.well-known/oauth-authorization-server`**

Static JSON, no logic. Add `Cache-Control: no-store` header.

```python
@app.get("/.well-known/oauth-authorization-server")
async def oauth_metadata(response: Response):
    response.headers["Cache-Control"] = "no-store, no-cache"
    return {
        "issuer": "https://api.whitepapper.antk.in",
        "authorization_endpoint": "https://api.whitepapper.antk.in/mcp/authorize",
        "token_endpoint": "https://api.whitepapper.antk.in/mcp/token"
    }
```

Dont hardcode base_url, use env values.

**`GET /mcp/authorize`**

Server-rendered HTML page. Does the following in order:

1. Read the `Authorization` header — this contains the Clerk session token sent by your frontend
2. Verify it using Clerk's Python SDK — `clerk.sessions.verify_token(token)`
3. If invalid, return a 401 HTML page with a "Please log in to Whitepapper first" message and a link to your login page
4. If valid, fetch all projects belonging to this user from Firestore
5. Render an HTML page with a `<select>` dropdown of their projects and a Connect button
6. The Connect button POSTs to `/mcp/token` with the selected `project_id` and the Clerk token

Keep the HTML minimal. One heading, one dropdown, one button. No styling needed beyond basic readability — this page flashes briefly in a popup, user barely sees it.

**`POST /mcp/token`**

Receives `project_id` and Clerk session token. Does:

1. Verify Clerk session token again (never trust client-side only)
2. Extract `user_id` from verified session
3. Confirm the project belongs to this user (Firestore lookup)
4. Call `generate_mcp_token(user_id, project_id)`
5. Return:

```json
{
  "access_token": "mcp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "token_type": "Bearer",
  "expires_in": 7776000
}
```

---

## Section 3 — MCP server (all tools)

File: `mcp_server.py`

```python
from mcp_server import build_mcp_router
app.include_router(build_mcp_router(), prefix="/mcp")
```

Add no-cache:

```python
@app.middleware("http")
async def no_cache_mcp(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/mcp") or request.url.path.startswith("/.well-known"):
        response.headers["Cache-Control"] = "no-store, no-cache"
    return response
```

Every tool follows this exact pattern at the start:

```python
token = request.headers.get("Authorization", "").replace("Bearer ", "")
ctx = resolve_mcp_token(token)
if not ctx:
    raise HTTPException(status_code=401)
project_id = ctx["project_id"]
```

Never accept `project_id` from the request body. Always from the token.

---

### Tool definitions

**`get_project_context`**

Tool description string (this is what the agent reads):
> Always call this tool first before any other tool. Read the project description and every collection's description carefully. Use this information to decide which collection new content belongs in. If no collection fits, create a new one with create_collection before creating the paper.

Returns:
```json
{
  "project_id": "...",
  "project_name": "...",
  "project_description": "...full markdown project context...",
  "collections": [
    {
      "id": "...",
      "name": "...",
      "description": "...",
      "papers": [ { "id": "...", "slug": "...", "title": "..." } ]
    }
  ],
  "standalone_papers": [ { "id": "...", "slug": "...", "title": "..." } ]
}
```

---

**`get_paper`**

Inputs: `paper_id: str`

Returns full paper:
```json
{
  "id": "...",
  "slug": "...",
  "title": "...",
  "markdown": "...",
  "collection_id": "...or null if standalone...",
  "seo": { "title": "...", "description": "..." }
}
```

---

**`create_paper`**

Inputs: `title, slug, markdown, collection_id (optional), seo_title (optional), seo_description (optional)`

Rules the code must enforce:
- Validate slug is unique within the project before writing — query Firestore, if duplicate return error `{ "error": "slug_taken", "message": "A paper with this slug already exists" }`
- If `collection_id` is null, paper goes directly under project as standalone
- Never auto-create a collection — if the agent passes a `collection_id` that doesn't exist, return error `{ "error": "collection_not_found" }`
- `seo_title` defaults to `title` if not provided
- `seo_description` defaults to empty string if not provided

Returns: `{ "id": "...", "slug": "..." }`

---

**`update_paper`**

Inputs: `paper_id, title (optional), markdown (optional), seo_title (optional), seo_description (optional)`

Rules:
- Only update fields that are explicitly passed
- Never wipe a field that wasn't passed — do a Firestore partial update, not a full document overwrite
- If `paper_id` doesn't exist in this project, return `{ "error": "not_found" }`

Returns: `{ "updated": true }`

---

**`delete_paper`**

Inputs: `paper_id: str`

Returns the title of the deleted paper in the response so the agent can confirm in chat:
```json
{ "deleted": true, "title": "Getting Started" }
```

---

**`update_project_description`**

Inputs: `markdown: str`

Overwrites the project's `description` field entirely. The agent uses this when the developer says something like "write a project description based on this README".

Returns: `{ "updated": true }`

---

**`create_collection`**

Inputs: `name: str, description: str`

Tool description string:
> Always provide a clear one-sentence description of what kind of content belongs in this collection. This description is used by AI agents to route content correctly.

`description` is required — return a validation error if empty.

Returns: `{ "id": "...", "name": "..." }`

---

**`update_collection`**

Inputs: `collection_id, name (optional), description (optional)`

Partial update, same rules as `update_paper`.

Returns: `{ "updated": true }`

---

**`delete_collection`**

Inputs: `collection_id: str, delete_papers: bool (default false)`

Rules:
- If `delete_papers` is false — move all papers in this collection to standalone (set `collection_id = null`) before deleting the collection
- If `delete_papers` is true — delete all papers in the collection, then delete the collection
- Always return what happened:

```json
{
  "deleted": true,
  "papers_moved": 3,
  "papers_deleted": 0
}
```

---

## Section 4 — Dashboard UI (Astro + shadcn)

One new settings tab inside the project settings page. Call it "IDE & API".

**Components to use (all shadcn):**
`Button`, `Card`, `CardHeader`, `CardContent`, `Badge`, `Separator`, `Table`, `TableRow`, `TableCell`, `Dialog`, `DialogContent`, `DialogHeader`, `Alert`

**Layout of the tab:**

**Card 1 — Connect to IDE**
Two buttons side by side:
- "Connect to VSCode" → `window.open("vscode://mcp/install?name=whitepapper&url=https://api.whitepapper.antk.in/mcp/sse")`
- "Connect to Cursor" → `window.open("cursor://mcp/install?name=whitepapper&url=https://api.whitepapper.antk.in/mcp/sse")`

Again, dont hardcode base url for api or website, use env values.

Below the buttons, a collapsed "Other IDEs" section with a copyable code block showing the manual JSON config:
```json
{
  "mcpServers": {
    "whitepapper": {
      "type": "sse",
      "url": "https://api.whitepapper.antk.in/mcp/sse"
    }
  }
}
```

**Card 2 — Active Connections**
A `Table` listing all active MCP tokens for this project. Columns: Label, Created, Expires, Revoke button. Revoke button opens a `Dialog` confirmation before calling the revoke endpoint. On revoke, row disappears from table.

**Card 3 — Dev API**
This already exists presumably — move it here or duplicate the API key display here so both MCP and dev API are in one place.

---

## Section 5 — New FastAPI endpoints for dashboard

These are normal REST endpoints (not MCP tools) that the Astro dashboard calls.

**`GET /projects/{project_id}/mcp-tokens`**
Returns active tokens for the project. Requires Clerk session auth (existing auth middleware). Returns the list from `list_mcp_tokens_for_user`.

**`DELETE /projects/{project_id}/mcp-tokens/{token_id}`**
Calls `revoke_mcp_token(token_id)`. Verifies the token belongs to this project before revoking.

No endpoint needed to generate a token manually — tokens are only generated through the OAuth flow.

---

## Build order

**Step 1** — `utils/mcp_auth.py` with all four utility functions. Write unit tests for `generate_mcp_token` and `resolve_mcp_token` before moving on. Verify hashing matches between generate and resolve.

**Step 2** — MCP server with all tools, hardcode a test `project_id` at the top of the file. Test every tool with curl using a fake Bearer token. Confirm all edge cases work — slug collision, missing collection, partial updates not wiping fields.

**Step 3** — Wire `resolve_mcp_token` into the MCP server. Replace hardcoded project ID. Test again with a real token generated by calling `generate_mcp_token` directly in a test script.

**Step 4** — Add `description` field to collections. Update `get_project_context` to include it. Update `create_collection` to require it.

**Step 5** — OAuth endpoints. Test the full browser flow manually — open `/mcp/authorize` in browser, verify the project picker renders, click Connect, verify `/mcp/token` returns a token.

**Step 6** — Deep link buttons + Active Connections table in Astro dashboard. Test full end-to-end: click button in dashboard → IDE opens → browser OAuth popup → user picks project → IDE connected → agent calls `get_project_context` successfully.

**Step 7** — `GET` and `DELETE` token endpoints for the dashboard. Wire the Revoke button in the Active Connections table.

---

## What to tell Codex at every step

Paste this at the top of every Codex prompt:

> The MCP server is a route group mounted at /mcp on the existing FastAPI app. It is not a separate service.
> Every MCP tool resolves project_id from the Bearer token only using resolve_mcp_token(). Never trust project_id from the request body.
> create_paper with no collection_id creates a standalone paper under the project. Never auto-create a collection.
> update_paper and update_collection do partial Firestore updates only. Never overwrite fields that were not passed.
> delete_collection with delete_papers=false must move papers to standalone before deleting. Never silently delete papers.
> The dev API is already built. MCP tools call Firestore directly via existing db utility functions. Do not call dev API endpoints from MCP tools.
> MCP token is hashed with SHA256 before storing in Firestore. The plain token is never stored.
> Clerk session verification happens server-side using CLERK_SECRET_KEY env var. Clerk tokens are verified but never stored.