# Whitepapper — Full Project Audit Report
**Date**: 2026-05-01  
**Scope**: Astro frontend, FastAPI backend, Cloudflare Worker proxy, NPM CLI & Component Registry  
**Methodology**: Full static code review across all `*.py`, `*.ts`, `*.tsx`, `*.astro`, `*.js`, `*.mjs`, `*.json` sources

---

## Executive Summary

| Area | Grade | Critical Issues | High | Medium | Low |
|------|-------|-----------------|------|--------|-----|
| FastAPI Backend | B | 2 | 8 | 12 | 8 |
| Astro Frontend | B- | 1 | 5 | 8 | 6 |
| Cloudflare Worker | B+ | 0 | 2 | 2 | 1 |
| NPM CLI | B | 0 | 1 | 3 | 2 |
| NPM Registry Components | C+ | 1 | 2 | 4 | 2 |

**Overall assessment**: The codebase is moderately well-structured with consistent patterns. However, there are several concerning security, performance, and correctness issues that should be addressed before production scale-up.

---

## 1. FastAPI Backend (`fastapi/`)

### 1.1 CRITICAL Issues

#### C1. In-memory OAuth state — No persistence across restarts
- **File**: `app/mcp_auth.py:65-67`
- **Impact**: HIGH — All pending OAuth authorizations, registration codes, and client registrations are stored in process-local dicts. A server restart (deploy, crash, scale) wipes all OAuth state. Users mid-flow get 404s.
- **Fix**: Persist `_pending_authorizations`, `_pending_codes`, `_registered_clients` in Redis or Firestore with TTL expirations (e.g., 10 min for auth, 20 min for codes).

#### C2. No OAuth state/pending code expiration
- **File**: `app/mcp_auth.py:65-67`
- **Impact**: HIGH — `_pending_authorizations` and `_pending_codes` dicts grow unbounded. Over time, this is a memory leak. Old codes remain valid indefinitely.
- **Fix**: Add a background cleanup task or store with expirable keys in Redis. Include `expires_at` timestamp and reject expired entries.

### 1.2 HIGH Issues

#### H3. `.env` contains `FIREBASE_SERVICE_ACCOUNT_JSON` as raw JSON in env
- **File**: `fastapi/.env.example:18`
- **Impact**: HIGH — Encourages storing the entire service account JSON as a single environment variable. This is error-prone (escaping issues) and leaks easily. If `.env` is committed by accident, the entire GCP account is compromised.
- **Fix**: Use `GOOGLE_APPLICATION_CREDENTIALS` pointing to a mounted secrets file, or use Workload Identity Federation. Never put service account JSON in env vars.

#### H4. No rate limiting on any endpoint
- **File**: `app/main.py` (no rate-limit middleware)
- **Impact**: HIGH — Public endpoints (`/public/*`), MCP tools, auth endpoints, and API key endpoints have no rate limiting. A single client can exhaust Groq API quota, Firestore read budget, or Redis connections.
- **Fix**: Add `slowapi` or middleware-based rate limiting. At minimum protect `/public/*`, `/oauth/*`, `/mcp/*`, and the dev API.

#### H5. MCP Bearer middleware does not enforce usage limits
- **File**: `app/mcp_auth.py:189-215`
- **Impact**: HIGH — The `McpBearerAuthMiddleware` authenticates the token but does not check if the user has exceeded `MCP_TOKEN_LIMIT_PER_MONTH`. The `is_user_usage_within_limit` function exists in `mcp_auth.py:85` but is never called in the middleware.
- **Fix**: Add a usage-limit check in the middleware dispatch before allowing the request through.

#### H7. No size/format validation on `body` field from MCP write tools
- **File**: `app/mcp/write_tools.py:128,161,194`
- **Impact**: HIGH — The `body` parameter for `create_paper` and `update_paper` via MCP tools accepts any string. While `validate_body_limits` checks length and image count, there is no validation that the content is safe Markdown/HTML. Malicious markdown could be served in public pages.
- **Fix**: Already partially mitigated by `rehype-sanitize` on the frontend (Astro), but server-side sanitization would be defense-in-depth.

### 1.3 MEDIUM Issues

#### M2. Missing `await` could cause silent errors
- **File**: `app/services/projects_service.py:77-83`
- **Impact**: MEDIUM — `_run_project_visibility_propagation` catches `Exception` broadly, which silently swallows all errors during visibility propagation.
- **Fix**: At minimum, log the exception type and context. Consider adding Sentry/error reporting.

#### M3. Inefficient slug-check scans all owned documents
- **File**: `app/services/projects_service.py:44-60`, `papers_service.py:426-468`, `collections_service.py:24-36`
- **Impact**: MEDIUM — Slug uniqueness checks load ALL owned items then filter in memory. For users near the 500-paper limit, this is O(n) per save.
- **Fix**: Add a Firestore composite index on `(ownerId, slug)` and query by equality instead of scanning.

#### M5. `paper_metadata_service` uses in-process dict cache with TTL
- **File**: `app/services/paper_metadata_service.py:47-49`
- **Impact**: MEDIUM — `_metadata_cache` is an in-process dict. In a multi-worker deployment (multiple Gunicorn/Uvicorn workers), each worker has its own cache, wasting memory and causing cache inconsistency.
- **Fix**: Use Redis for shared metadata cache, or accept per-worker cache as intentional.

#### M8. No security headers set
- **File**: `app/main.py` — No `SecureHeadersMiddleware`
- **Impact**: MEDIUM — Missing `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy` headers.
- **Fix**: Add a middleware that sets security headers. FastAPI's `SecureHeadersMiddleware` or manual middleware.

#### M9. `req_body` for non-GET/HEAD reads entire body into memory
- **File**: `cloudflare-proxy/worker.js:32-34`
- **Impact**: MEDIUM — Works correctly but for large file uploads proxied through the worker, the entire body is passed through stream-like. Consider size limits on the worker or detect upload endpoints.

#### M10. No structured logging / tracing
- **Files**: Throughout FastAPI
- **Impact**: MEDIUM — `logging.info` is used inconsistently. No request ID propagation, no correlation IDs. Difficult to debug production issues.
- **Fix**: Add a middleware that generates `X-Request-ID` and injects it into log context.

#### M11. `mcp/` path routing is fragile
- **File**: `app/mcp_auth.py:190-192`, `app/mcp_resources.py`
- **Impact**: MEDIUM — The `McpBearerAuthMiddleware` only applies to `path.rstrip("/") == "/mcp"`. But the FastMCP app is mounted at `/mcp`, meaning sub-paths like `/mcp/sse` and `/mcp/messages` bypass the bearer auth check.
- **Fix**: Change the middleware path check to include `/mcp/*` sub-paths, or ensure FastMCP itself enforces auth on all its routes.

#### M12. User creation from webhooks does not validate username format
- **File**: `app/api/v1/endpoints/webhooks.py:78-85`
- **Impact**: MEDIUM — Clerk webhook `user.created` passes `data.get("username")` directly to `user_service.create_user()`. If Clerk sends a username with special characters or reserved names, the user could get an invalid username.
- **Fix**: Validate and sanitize the username before creating the user.

### 1.4 LOW Issues

#### L1. `firestore_store` global singleton — testability concern
- **File**: `app/core/firestore_store.py:176`
- **Impact**: LOW — Module-level `firestore_store = FirestoreStore()` prevents dependency injection for testing.
- **Fix**: Use a factory function or pass the store as a dependency.

#### L2. Inconsistent use of `from __future__ import annotations`
- **Impact**: LOW — Some files have `from __future__ import annotations`, others don't. Python 3.10+ handles this natively, but inconsistency suggests no linting rule.

#### L3. `threading.Thread(daemon=True)` for visibility propagation
- **File**: `projects_service.py:317-322`, `collections_service.py:195-202`
- **Impact**: LOW — Using raw threads with `daemon=True` means propagation can be killed mid-operation on server shutdown. Use `BackgroundTasks` from FastAPI where possible, or a task queue.

#### L4. Redundant `strip()` calls
- **Impact**: LOW — Throughout the codebase, values are `str(value or "").strip()` multiple times in the same call chain.

#### L5. `sort_items_latest_first` imported but unused in some files
- **File**: `app/api/v1/endpoints/projects.py:12`
- **Impact**: LOW — `sort_items_latest_first` is imported but only used in the dashboard endpoint.

#### L6. Search ranks by naive substring count — biased
- **File**: `app/services/papers_service.py:304-340`
- **Impact**: LOW — The search scoring adds 3 for a match then counts occurrences. Documents with repeated words get inflated scores. Basic TF-IDF or BM25 would be more accurate.

#### L7. Environment variable mismatch: `.env.example` uses `VALKEY_*` but code uses `redis_*`
- **File**: `fastapi/.env.example:25-29` vs `app/core/config.py:36-40`
- **Impact**: LOW — The example `.env` file documents `VALKEY_SERVICE_URI`, `VALKEY_HOST`, etc., but the `Settings` class reads `redis_service_uri`, `redis_host`, etc. Users following the example will set wrong env vars.
- **Fix**: Align env var names or add aliases.

#### L8. `@lru_cache` on `build_mcp_router()` embeds env values once
- **File**: `app/mcp_auth.py:218-219`
- **Impact**: LOW — `build_mcp_router` is cached with `@lru_cache(maxsize=1)`. The `_oauth_authorize_url()` etc. call `get_settings()` each time (not cached), but the closure captures the first call's result. If env vars change between hot reloads, stale URLs persist.
- **Fix**: Don't cache the router, or re-resolve env vars inside the handlers.

---

## 2. Astro Frontend (`astro/`)

### 2.1 CRITICAL Issues

### 2.2 HIGH Issues

#### H2. No error boundary for React islands
- **File**: `src/pages/[handle]/index.astro:110`, `src/pages/[handle]/[slug].astro:143`
- **Impact**: HIGH — `ProfilePage`, `LinesTableOfContent`, and `MobileTableOfContent` use `client:load` without any error boundary. If any React component crashes client-side, the entire page becomes blank/white.
- **Fix**: Wrap each client island with an `<ErrorBoundary>` component.

### 2.3 MEDIUM Issues

#### M1. `<img>` on paper page lacks explicit `width`/`height`
- **File**: `src/pages/[handle]/[slug].astro:127-135`
- **Impact**: MEDIUM — The thumbnail `<img>` has no `width`/`height` attributes, only CSS classes. This causes CLS (Cumulative Layout Shift) while the image loads.
- **Fix**: Add explicit `width` and `height` attributes (or use the Astro `<Image>` component).

#### M3. Hardcoded `markdown-render` component CSS uses fixed colors
- **File**: `npm-components/registry/markdown-render/markdown-render.css:1-561`
- **Impact**: MEDIUM — All 560 lines of markdown CSS use hardcoded light-theme colors. No CSS variables, no `.dark` class overrides. Dark-mode users get blinding white code blocks.
- **Fix**: Convert to CSS custom properties that respect the site's theme.

#### M4. `rehypeShikiSync` not called (broken syntax highlighting)
- **File**: `npm-components/registry/markdown-render/markdown-render.tsx:107`
- **Impact**: MEDIUM — `rehypeShikiSync` is a wrapper function; it must be called with `()` to produce the actual plugin. Currently it's passed as a reference, so Shiki syntax highlighting never executes.
- **Fix**: Change `rehypeShikiSync` to `rehypeShikiSync()` in the rehypePlugins array.

#### M5. Inefficient re-renders from `MutationObserver` in TOC components
- **File**: `registry/toc/linearTableOfContent.tsx`, `linesTableOfContent.tsx`, `mobileTableOfContent.tsx`
- **Impact**: MEDIUM — All three TOC components independently set up `MutationObserver` on the document body and re-extract headings. This is 3 observers on the same page all watching for DOM changes.
- **Fix**: Extract heading observation into a shared hook with a single `MutationObserver`.

#### M6. `public-api` endpoint responses are not cached efficiently
- **File**: `src/lib/api/public.ts:1-9`
- **Impact**: MEDIUM — Public API calls return raw JSON through a thin wrapper. No deduplication between SSR pages that request the same data (e.g., profile page and paper page both loading author info).
- **Fix**: Add a request-level cache using `Astro.locals` or a `Map` scoped to the request lifecycle.

### 2.4 LOW Issues

#### L1. Placeholder favicon / missing manifest
- No `site.webmanifest` or `manifest.json` found in `public/`.

#### L2. `font-[Satoshi]` used without fallback
- **File**: `src/pages/[handle]/index.astro:66`
- **Impact**: LOW — `font-[Satoshi]` has no fallback font stack. If the font fails to load, the browser falls back to the default serif/sans-serif.
- **Fix**: Add fallback: `font-[Satoshi, system-ui, sans-serif]`.

#### L3. Inline `style` attributes use CSS properties that could be Tailwind classes
- **File**: `[handle]/index.astro:91,94,97-100`
- **Impact**: LOW — `style={{ lineHeight: "1.4em" }}` and animation delays are inline. These work but are inconsistent with the Tailwind-first approach.

#### L4. Toast library imported but not obviously used
- **File**: `astro/package.json:43` — `sonner` dependency. May be used in React islands. Verify it's actually used.

#### L5. `rehype-raw` combined with `rehype-sanitize` — correct but check allowlist
- **File**: `npm-components/registry/markdown-render/markdown-render.tsx`
- **Impact**: LOW — `rehype-sanitize` default schema is being used. Verify that the default allowlist permits all expected HTML (tables, code blocks, etc.). The current setup is correct for security.

#### L6. `check:sitemaps` script exists but no `lint` or `typecheck` scripts in `astro/package.json`
- **File**: `astro/package.json:8-12`
- **Impact**: LOW — Only `astro check` exists for type-checking. No ESLint or Prettier configured for Astro project.

---

## 3. Cloudflare Worker (`cloudflare-proxy/worker.js`)

### 3.1 HIGH Issues

#### H2. Cache key includes raw upstream URL — leaks query params
- **File**: `worker.js:18`
- **Impact**: HIGH — `new Request(upstreamUrl, request)` uses the full URL including query parameters as the cache key. This means `?token=xxx` gets cached and served to other users requesting the same URL.
- **Fix**: Strip sensitive query params from the cache key, or use `request.url` (the original client URL) as the key.

### 3.3 LOW Issues

#### L1. No health check endpoint
- **File**: `worker.js` — No dedicated `/health` or `/` route.
- **Impact**: LOW — Makes uptime monitoring harder.

---

## 4. NPM CLI (`npm-components/cli/`)

### 4.1 HIGH Issues

#### H1. Hardcoded registry URL points to `master` branch
- **File**: `src/index.ts:27`
- **Impact**: HIGH — `https://raw.githubusercontent.com/abhraneeldhar7/whitepapper/master/npm-components/registry/registry.json` — if the default branch is renamed to `main`, the CLI breaks for all users. Also leaks the GitHub username.
- **Fix**: Use a tag-based URL, or a dedicated CDN hostname (e.g., `https://registry.whitepapper.ai/registry.json`).

### 4.2 MEDIUM Issues

#### L2. No test files
- **Impact**: LOW — No `*.test.ts` or `*.spec.ts` files in the CLI package.

---

## 5. NPM Registry Components (`npm-components/registry/`)

### 5.1 CRITICAL Issues

#### C1. `rehypeShikiSync` passed as reference, not called
- **File**: `markdown-render/markdown-render.tsx:107`
- **Impact**: CRITICAL — The Shiki syntax highlighting plugin is never activated. Code blocks render as plain `<pre><code>` without any syntax highlighting. This is a user-facing broken feature.
- **Fix**: Change to `rehypeShikiSync()` (call the wrapper to get the actual plugin).

### 5.2 HIGH Issues

#### H1. Hardcoded GitHub raw URLs in `registry.json`
- **File**: `registry.json`
- **Impact**: HIGH — All component file URLs point to `https://raw.githubusercontent.com/.../master/...`. If the branch is renamed or the file moves, all CLI `whitepapper add` commands break.
- **Fix**: Use versioned CDN URLs or release tags.

#### H2. No type definitions exported
- **File**: `registry.json` — No `types` or `typings` field. TypeScript consumers get no type hints.
- **Fix**: Add `.d.ts` files and reference them in `registry.json`.

### 5.3 MEDIUM Issues

#### M1. Three independent duplicate heading extractors
- **Files**: `linearTableOfContent.tsx`, `linesTableOfContent.tsx`, `mobileTableOfContent.tsx`
- **Impact**: MEDIUM — ~180 lines of duplicated `extractHeadings` + `MutationObserver` + retry logic across three files.

#### M2. `cn()` utility redefined in `animated-theme-toggler.tsx`
- **File**: `animated-theme-toggler.tsx:5-16`
- **Impact**: MEDIUM — Instead of importing from a shared location, the `cn()` helper is re-implemented inline.

#### M3. CommonJS/ESM status unclear
- **File**: `registry.json` — No `type` field indicating module format. Consumers need to guess.

#### M4. No dark mode in markdown CSS
- **File**: `markdown-render.css:1-561`
- **Impact**: MEDIUM — All 560 CSS lines use fixed light colors. Dark mode renders incorrectly.

### 5.4 LOW Issues

#### L1. `window.clearInterval` with possibly-undefined retryId
- **File**: `mobileTableOfContent.tsx:97-104`
- **Impact**: LOW — If headings are found on first try, `retryId` is never assigned, but cleanup calls `clearInterval(retryId)` with `undefined`. Harmless but sloppy.

#### L2. `peerDependencies` listed as `dependencies`
- **File**: `registry.json` — Component dependencies don't distinguish between peer deps (`react`, `react-dom`) and runtime deps.

---

## Prioritized Action Plan

### 🔴 Immediate (Critical — Fix Now)
2. **Persist OAuth state** — `mcp_auth.py:65-67` — Lost on restart
3. **Add OAuth state expiration** — `mcp_auth.py:65-67` — Memory leak

### 🟠 High Priority (Fix This Week)
8. Add rate limiting to all public endpoints
9. Check MCP usage limits in middleware
10. Add error boundaries to React islands
12. Add explicit width/height to thumbnail image
13. Fix dark mode in markdown CSS
14. Align `.env.example` variable names (VALKEY vs redis)

### 🟡 Medium Priority (Fix This Sprint)
15. Add security headers to FastAPI
16. Fix MCP routing to protect sub-paths
18. Fix slug uniqueness from O(n) to indexed queries
19. Add SRI hashes to external resources
20. Fix Worker cache key to exclude query params
21. Change CLI registry URL to CDN-based
22. Add structured logging with request IDs
23. Extract shared heading observer hook

### 🟢 Low Priority (Backlog)
25. Convert `firestore_store` from singleton to injectable
26. Add ESLint/Prettier to Astro project
27. Add test files to CLI package
29. Add health check to Worker
31. Add fallback font stack to `font-[Satoshi]`

---

## Component-Wise Summary

| Component | Files | LOC (approx) | Quality | Issues |
|-----------|-------|------|---------|--------|
| FastAPI Backend | 40+ | ~3,000 | B | 2 Critical, 4 High, 8 Medium |
| Astro Frontend | 100+ | ~5,000 | B- | 0 Critical, 2 High, 5 Medium |
| Cloudflare Worker | 1 | 68 | B+ | 0 Critical, 1 High, 0 Medium |
| NPM CLI | 1 | 205 | B | 0 Critical, 1 High, 0 Medium |
| NPM Registry | 8 | ~2,000 | C+ | 1 Critical, 2 High, 4 Medium |

---

*Audit performed by full static code review. Runtime behavior and integration tests were not performed. Some issues (especially related to multi-worker deployments, Firestore index configuration, and Clerk webhook edge cases) require live environment testing to confirm.*
