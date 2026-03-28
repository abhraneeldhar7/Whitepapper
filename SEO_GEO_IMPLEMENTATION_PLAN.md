# Whitepapper SEO + GEO Implementation Plan

Last updated: 2026-03-29
Scope: Maximize traditional SEO (Google/Bing) and GEO (AI search visibility) for the Astro frontend and FastAPI backend in this repo.

## 1) Executive Summary

Current state has critical crawl/index/content gaps:

- No SEO metadata system (titles, descriptions, canonicals, OG/Twitter tags) in shared layout.
- No sitemap, no robots strategy, no structured data.
- Important nav links point to missing routes (`/blog`, `/pricing`, `/int`), causing internal crawl waste.
- Multiple thin pages with placeholder text only (`docs`, `blogs`, `integrations`, `components`, `privacy-policy`, `terms-of-service`).
- Public content discoverability is weak: collection papers are mostly hidden behind client interactions and no sitemap.
- Public pages have duplicate URL risk due handle/slug normalization without canonical redirects.
- Public API payload/query patterns can be faster (redundant calls, no pagination, no response caching headers at API layer).

## 2) High-Priority Findings (Code Evidence)

### Critical

1. No global metadata framework
- File: `astro/src/layouts/Layout.astro`
- Only `<title>` exists; no meta description, canonical, robots, OG, Twitter, JSON-LD support.

2. Broken internal links in home nav
- File: `astro/src/pages/index.astro`
- Links currently include `/int`, `/blog`, `/pricing` but these pages do not exist.

3. Thin/placeholder pages are indexable quality risk
- Files:
  - `astro/src/pages/blogs.astro`
  - `astro/src/pages/docs.astro`
  - `astro/src/pages/integrations.astro`
  - `astro/src/pages/components.astro`
  - `astro/src/pages/privacy-policy.astro`
  - `astro/src/pages/terms-of-service.astro`
- Each file currently contains only 1 line of plain text.

4. Soft-404 behavior risk from redirects to `/404`
- Files:
  - `astro/src/pages/[handle]/index.astro`
  - `astro/src/pages/[handle]/p/[projectSlug]/index.astro`
- Not-found cases use redirects instead of direct 404 response rendering.

5. No sitemap/robots endpoints or config
- File: `astro/astro.config.mjs`
- No `site` config and no sitemap integration.
- No robots page/file in `astro/src/pages`.

### High

6. Public project page performs redundant data retrieval
- File: `astro/src/pages/[handle]/p/[projectSlug]/index.astro`
- Fetches project data, then separately fetches owner profile (`getPublicProfile`) even though both are public payload concerns.

7. URL duplication risk from normalization without redirect
- Files:
  - `astro/src/pages/[handle]/index.astro`
  - `astro/src/pages/[handle]/[slug].astro`
  - `astro/src/pages/[handle]/p/[projectSlug]/index.astro`
- `@handle`, uppercase handles, and slug variants resolve to same content but are not canonically redirected.

8. Collection paper discovery is weak for bots
- File: `astro/src/components/project/ProjectCollectionsViewer.tsx`
- Collection papers are fetched only on accordion interaction, limiting crawl discovery without strong sitemap support.

9. Public pages hydrate large React islands
- Files:
  - `astro/src/pages/[handle]/index.astro` (`ProfilePage client:load`)
  - `astro/src/pages/[handle]/p/[projectSlug]/index.astro` (`PublicProjectPage client:load`)
- Moves more JS to clients than needed for mostly content pages.

10. No image SEO baseline
- Files:
  - `astro/src/components/paperCardComponent.tsx`
  - `astro/src/components/project/PublicProjectPage.tsx`
- Several images miss `alt`, explicit dimensions, and optimized delivery path.

### Medium

11. Public API has no pagination for potentially large lists
- File: `fastapi/app/api/v1/endpoints/public.py`
- Endpoints return full arrays for projects/papers/collections.

12. Public API list methods rely on unbounded field scans
- Files:
  - `fastapi/app/services/papers_service.py`
  - `fastapi/app/services/projects_service.py`
  - `fastapi/app/core/firestore_store.py`
- `find_by_fields(...).stream()` without cursor pagination or ordering for public feed endpoints.

13. Missing API-level response caching/compression headers
- Files:
  - `fastapi/app/main.py`
  - `fastapi/app/api/v1/endpoints/public.py`
- No gzip middleware and no public endpoint cache-control/etag policy.

## 3) Target SEO + GEO Architecture

### 3.1 Metadata + Canonical System (Global)

Implement a shared SEO props model in layout:

- `title`
- `description`
- `canonical`
- `robots`
- `ogType`, `ogImage`, `ogSiteName`
- `twitterCard`, `twitterSite`
- `jsonLd` (array support)

Files to change:
- `astro/src/layouts/Layout.astro`
- New helper: `astro/src/lib/seo.ts`

### 3.2 Robots + Sitemap + Feeds

Add:

- `astro/src/pages/robots.txt.ts`
- `astro/src/pages/sitemap-index.xml.ts`
- `astro/src/pages/sitemaps/public-pages.xml.ts`
- `astro/src/pages/sitemaps/public-papers.xml.ts`
- `astro/src/pages/sitemaps/public-projects.xml.ts`
- `astro/src/pages/rss.xml.ts` (marketing/blog feed)

Use segmented sitemaps for scaling and easier monitoring.

### 3.3 Structured Data (JSON-LD)

Add JSON-LD by page type:

- Homepage: `Organization`, `WebSite`
- User page: `Person`, `ProfilePage`
- Project page: `CollectionPage` or `CreativeWorkSeries`
- Paper page: `Article` + `BreadcrumbList`
- Blog post pages: `BlogPosting`

### 3.4 GEO (AI Search) Layer

Add:

- `/llms.txt` (concise map of high-value URLs + product definition)
- `/llms-full.txt` (expanded, machine-friendly knowledge document)
- Q&A blocks on key pages (problem -> approach -> examples -> constraints)
- Strong author/entity signals (real author cards, updated dates, source citations)
- Comparison pages and use-case pages with structured, factual answers

## 4) Public User/Project/Paper Page Upgrade Plan

### 4.1 `/[handle]` user page

Current issues:
- Minimal metadata, no Person schema, potential duplicate URLs.

Changes:
- Add unique title/description from user profile.
- Add canonical URL and normalized redirect (`/@name` -> `/name`, uppercase -> lowercase).
- Add `Person` + `ProfilePage` JSON-LD.
- Add server-rendered links to all public content (standalone + collection papers via dedicated pages or sitemap guarantee).
- Keep only small interactive island for tab switching if needed.

### 4.2 `/[handle]/p/[projectSlug]` project page

Current issues:
- No metadata/schema.
- Redundant owner fetch.
- Collection paper links are loaded lazily.

Changes:
- Include owner in project API payload; remove extra profile request.
- Add `CollectionPage` schema and rich metadata.
- Pre-render top papers and collection links server-side.
- Add paginated collection pages if project is large.

### 4.3 `/[handle]/[slug]` paper page

Current issues:
- No article metadata/schema.
- Duplicate URL normalization risk.

Changes:
- Add `Article` JSON-LD and `BreadcrumbList`.
- Add reading-time, updated-at, author link, related papers internal links.
- Add canonical redirect rules for slug normalization.
- Add server-side excerpt generation for description when missing.

## 5) Pages To Add and Modify

### 5.1 Must Add (Revenue + Authority + GEO)

1. `/pricing`
2. `/blog` (index)
3. `/blog/[slug]` (marketing posts)
4. `/features`
5. `/use-cases/[segment]` (at least 4 initial segments)
6. `/compare/[alternative]` (at least 3 initial alternatives)
7. `/changelog`
8. `/about`
9. `/contact`
10. `/llms.txt`
11. `/llms-full.txt`
12. `/robots.txt`
13. Sitemap endpoints (index + segmented maps)

### 5.2 Must Fix Existing Routes

1. `index.astro` nav links (`/int`, `/blog`, `/pricing`) -> valid URLs.
2. Expand all one-line thin pages or set temporary `noindex` until complete.
3. Footer must expose crawlable legal/support links.
4. Reserve new root paths in:
- `astro/src/lib/reservedPaths.ts`
- `fastapi/app/core/reserved_paths.py`

## 6) Blog Strategy (Topics + Information Architecture)

### 6.1 Recommended blog clusters

Cluster A: Programmatic SEO and content operations
- Programmatic SEO fundamentals for API-first CMS
- Building content hubs that avoid cannibalization
- Scaling internal linking with structured content

Cluster B: Developer publishing workflows
- Markdown-first publishing architecture
- Multi-channel distribution automation
- CMS API design patterns for teams

Cluster C: AI search readiness (GEO)
- How LLMs retrieve and cite web content
- Designing pages for AI overview inclusion
- Entity SEO and structured data for developer products

Cluster D: Technical SEO for content-heavy products
- Core Web Vitals for content platforms
- Crawl budget and pagination in dynamic sites
- Canonicalization patterns for user-generated content

### 6.2 Suggested first 20 posts

Create 5 posts per cluster above, with one pillar page per cluster and 4 supporting posts each. Interlink pillar <-> supporting posts bi-directionally.

## 7) Where To Store Blog Data (Yes, Database Is Fine)

Yes, you can store blogs in a database. Recommended approach:

### Option A (Recommended for your stack): Firestore-backed blog content

New collections:

- `marketingPosts`
- `marketingAuthors`
- `marketingCategories`
- `marketingTags`

`marketingPosts` fields:
- `postId`, `slug`, `title`, `excerpt`, `bodyMarkdown`
- `authorId`, `categoryId`, `tagIds[]`
- `status` (`draft|published`)
- `publishedAt`, `updatedAt`
- `canonicalUrl`
- `coverImageUrl`, `coverImageAlt`
- `metaTitle`, `metaDescription`
- `ogImageUrl`

Rules:
- Precompute and store `readingTime`, `toc`, `wordCount`.
- Cache list/detail responses in Redis.
- Serve paginated APIs (`cursor`, `limit`).

### Option B: MDX files in repo for marketing pages

Best for editorial versioning and static pre-render speed.

### Hybrid recommendation

- Marketing blog/docs pages in MDX (high control, fast builds).
- User-generated papers/projects remain in Firestore.

## 8) Data Fetching and Speed Improvement Plan

### Frontend (Astro)

1. Remove redundant API calls on project page by extending one backend payload.
2. Convert large public pages to mostly server-rendered HTML with small client islands.
3. Avoid loading collection papers only after click if discoverability matters; render crawlable links.
4. Add image optimization strategy (dimensions, modern format, priority only for LCP image).
5. Add explicit cache policy per route and avoid inconsistent headers.

### Backend (FastAPI + Firestore)

1. Add paginated public list endpoints:
- `/public/{handle}?paper_limit=...&paper_cursor=...`
- `/public/{handle}/projects/{project_slug}?...`
2. Add pre-sorted query support in store layer (`order_by`, `limit`, `start_after`).
3. Add aggregate cache keys for public profile/project payloads.
4. Add response compression middleware.
5. Add `Cache-Control` and optional `ETag` on public responses.
6. Add lightweight list DTOs for cards (avoid large body fields unless needed).

## 9) Phase-by-Phase Implementation

### Phase 0 (Day 1-2): Critical crawl/index foundation

1. Build global SEO metadata system in layout.
2. Add robots + sitemap endpoints.
3. Fix nav links and route mismatches.
4. Decide canonical host and enforce HTTPS/non-www policy.
5. Replace 302-to-404 pattern with proper 404 responses.

Success criteria:
- Every indexable URL has unique title + description + canonical.
- Sitemaps live and robots references them.

### Phase 1 (Day 3-5): Public page SEO + schema

1. Implement metadata + JSON-LD for user/project/paper pages.
2. Normalize URLs with redirect rules.
3. Improve heading structure and on-page content snippets.
4. Add related-content internal linking on paper pages.

Success criteria:
- Rich Results validation passes for article/profile pages.
- No duplicate URL variants in crawl exports.

### Phase 2 (Week 2): Content and GEO expansion

1. Launch `/blog`, `/pricing`, `/features`, `/use-cases`, `/compare`.
2. Publish first 20 posts across 4 clusters.
3. Add `/llms.txt` + `/llms-full.txt`.
4. Add author pages and E-E-A-T elements.

Success criteria:
- Search Console indexed pages grows steadily.
- AI assistants can retrieve clean product definitions and citations.

### Phase 3 (Week 3): Performance and scale

1. Add pagination and caching for heavy public endpoints.
2. Reduce hydration JS on public pages.
3. Introduce query-level optimization in Firestore access layer.
4. Add monitoring dashboards and SLOs.

Success criteria:
- Lower TTFB and faster LCP on public pages.
- Stable response times under larger datasets.

## 10) Manual Tasks Outside This Project

1. Google Search Console
- Verify domain property.
- Submit sitemap index.
- Inspect and request indexing for key new pages.
- Monitor coverage, CWV, and enhancement reports weekly.

2. Bing Webmaster Tools
- Verify site and submit sitemap.

3. Analytics and monitoring
- GA4 + conversion events for signups and content-to-signup paths.
- Track organic landing pages, CTR, and assisted conversions.

4. CDN and hosting
- Ensure Brotli/gzip enabled at edge.
- Confirm caching behavior for HTML vs static assets.

5. Editorial process
- Assign author owners per cluster.
- Publish cadence: minimum 2 posts/week for first 10 weeks.
- Quarterly content refresh for top pages.

6. Authority building
- Acquire links from developer communities and partner integrations.
- Publish benchmark/case-study posts with original data.

7. Brand/entity consistency
- Keep organization name, social profiles, and product description consistent across site and external profiles.

## 11) KPI Dashboard (Track Weekly)

Primary:
- Indexed pages
- Non-brand impressions and clicks
- Avg position for target clusters
- Organic signup conversions

Technical:
- LCP, INP, CLS for top templates
- Crawl errors and duplicate/canonical issues
- Sitemap indexed-to-submitted ratio

GEO:
- Brand/entity mentions in AI answers
- Citation frequency of your domain in AI outputs
- Referral traffic from AI assistants (when detectable)

## 12) Immediate Next 10 Engineering Tasks

1. Implement SEO prop contract in `Layout.astro`.
2. Add `seo.ts` helper to generate canonical/meta defaults.
3. Create `robots.txt.ts` and sitemap routes.
4. Fix broken nav URLs in `index.astro`.
5. Replace one-line thin pages with real content or temporary `noindex`.
6. Add page metadata + JSON-LD to:
- `[handle]/index.astro`
- `[handle]/p/[projectSlug]/index.astro`
- ~~`[handle]/[slug].astro`~~
7. Add normalized redirect logic for handle/slug variants.
8. Extend public project API to include owner summary in one response.
9. Add pagination params to public profile/project APIs.
10. Add FastAPI compression and response cache headers for public endpoints.

---

If you execute Phases 0 and 1 completely, you should see meaningful crawl/index quality improvement quickly. Phases 2 and 3 are where long-term SEO + GEO compounding happens.
