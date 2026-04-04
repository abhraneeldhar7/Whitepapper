# Whitepapper SEO + GEO Pending Implementation Audit

Date: 2026-04-05
Scope: What is still not implemented in the repo (SEO + GEO), and what to change next.

## Executive Summary

Most technical SEO foundations are now in place (metadata framework, structured data coverage for core templates, segmented sitemaps, robots, llms files, canonical redirects, and image baseline).

The largest remaining gaps are:

1. Missing high-intent marketing pages (`/pricing`, `/features`, `/use-cases/*`, `/compare/*`, `/changelog`) and `/blog` path family expected by the plan.
2. No pagination on public APIs and still-unbounded Firestore list reads.
3. No enforced canonical host/HTTPS policy at app edge.
4. GEO depth gaps: missing citation-backed content, missing author pages, and missing comparison/use-case answer pages.
5. Inconsistent public-route cache policy coverage.

---

## Findings (Not Implemented Yet)

### 1) Marketing page architecture is incomplete
- Issue: Required pages from the plan are missing.
- Impact: High (limits ranking surface area and GEO retrieval coverage for commercial/problem-intent queries).
- Evidence:
  - Missing route files:
    - `astro/src/pages/pricing.astro`
    - `astro/src/pages/features.astro`
    - `astro/src/pages/changelog.astro`
    - `astro/src/pages/use-cases/*`
    - `astro/src/pages/compare/*`
  - Only `/blogs` exists, while `/blog` + `/blog/[slug]` are not present.
- Changes needed:
  - Add all required pages with unique metadata + schema per template.
  - Either:
    - Implement `/blog` and `/blog/[slug]`, or
    - 301 redirect `/blog` -> `/blogs` and `/blog/:slug` -> `/blogs/:slug` to match plan intent and avoid split IA.

### 2) Public API pagination is not implemented
- Issue: Public endpoints still return full arrays with no `limit/cursor`.
- Impact: High (scalability, crawl budget, latency, and payload bloat risks).
- Evidence:
  - `fastapi/app/api/v1/endpoints/public.py:141` `get_public_profile(...)` returns full `projects` + `papers`.
  - `fastapi/app/api/v1/endpoints/public.py:169` `get_public_project(...)` returns full `collections`, `papers`, and collection papers.
- Changes needed:
  - Add query params:
    - `/public/{handle}?paper_limit=&paper_cursor=&project_limit=&project_cursor=`
    - `/public/{handle}/projects/{project_slug}?paper_limit=&paper_cursor=&collection_limit=&collection_cursor=`
  - Return `items + nextCursor` payload shape.
  - Keep backward-compatible defaults if old clients exist.

### 3) Store/query layer still uses unbounded streams
- Issue: Public list paths still rely on `find_by_fields(...).stream()` without ordering/limits/cursor support.
- Impact: High at scale (query cost and unpredictable latency).
- Evidence:
  - `fastapi/app/core/firestore_store.py:47-51` `find_by_fields(...)` streams all matches.
  - `fastapi/app/services/papers_service.py:198-242` list methods call `find_by_fields(...)` directly.
  - `fastapi/app/services/projects_service.py:160-167` list methods call `find_by_fields(...)`.
- Changes needed:
  - Add ordered + paginated query helpers in store layer (`order_by`, `limit`, `start_after`).
  - Migrate public list methods first.
  - Add deterministic sort (e.g., `updatedAt desc`, then `id` tie-breaker).

### 4) Canonical host/HTTPS policy is not enforced
- Issue: No explicit canonical host policy in Astro config/middleware.
- Impact: Medium-High (duplicate host/protocol variants, weaker canonical consistency).
- Evidence:
  - `astro/astro.config.mjs:7-30` has no `site` setting and no canonical host enforcement settings.
  - `astro/src/middleware.ts:1-31` handles auth redirects only; no host/protocol redirect logic.
- Changes needed:
  - Set canonical `site` in Astro config.
  - Add middleware redirect policy to enforce one host + HTTPS.
  - Ensure canonical URLs and sitemap URLs always match canonical host.

### 5) Public cache policy is inconsistent across pages
- Issue: Some public pages set cache headers, some do not.
- Impact: Medium (inconsistent edge behavior, weaker performance predictability).
- Evidence:
  - Has cache header:
    - `astro/src/pages/index.astro`
    - `astro/src/pages/blogs.astro`
    - `astro/src/pages/resources.astro`
    - `astro/src/pages/updates.astro`
    - public handle/paper routes
  - Missing explicit cache header:
    - `astro/src/pages/contact.astro:1-14`
    - `astro/src/pages/about.astro:1-90`
    - `astro/src/pages/integrations.astro:1-10`
- Changes needed:
  - Define route-level caching matrix (marketing list/detail/static/legal).
  - Apply consistently via middleware or a shared helper pattern.

### 6) GEO citation depth and entity proofing are still partial
- Issue: GEO scaffolding exists (`llms.txt`, `llms-full.txt`, Q&A), but citation-backed assertions and entity pages are still incomplete.
- Impact: Medium (lower trust/extractability for AI answer systems).
- Evidence:
  - `astro/src/pages/llms-full.txt.ts` provides facts/Q&A but no citation section with supporting source links per claim.
  - No dedicated author pages in `astro/src/pages` (`authors` routes absent).
  - No compare/use-case landing pages (high GEO utility pages) are present.
- Changes needed:
  - Add source-citation blocks (claim -> source URL) on key pages and/or in `llms-full`.
  - Add author entity pages (`/authors/[slug]`) and connect blog/paper authors to those URLs.
  - Add compare/use-case pages with factual, structured Q&A and schema.

### 7) Large project collection pagination UI/API is not implemented
- Issue: Project pages still load all collection papers in one response.
- Impact: Medium (payload growth and crawl/render cost on large accounts).
- Evidence:
  - `fastapi/app/api/v1/endpoints/public.py:173-198` fetches full collection + paper sets.
  - `astro/src/pages/[handle]/p/[projectSlug]/index.astro` consumes full payload.
- Changes needed:
  - Add collection/paper pagination contracts in API.
  - Render first page server-side and progressively fetch subsequent pages.
  - Keep crawlable links for first-page discoverability.

---

## Prioritized Next Actions

1. Implement public API pagination + store-layer ordered pagination.
2. Launch missing high-intent routes (`pricing`, `features`, `use-cases`, `compare`, `changelog`) and `/blog` alias strategy.
3. Enforce canonical host + HTTPS in config/middleware.
4. Normalize cache headers across all public pages.
5. Add GEO citations + author pages.
