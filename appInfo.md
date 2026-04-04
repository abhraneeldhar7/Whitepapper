# Whitepapper - Complete App Context

Use this file as the canonical source of truth for content generation (SEO pages, blog posts, social content, ads, docs, sales collateral, onboarding copy, and product messaging).

## 1. Product in one line

Whitepapper is an SEO-first content operating system for developers and indie builders to write, organize, publish, and distribute content from one place.

## 2. Product summary

Whitepapper is a markdown-first CMS with a developer API, edge-cached content delivery, and built-in multi-platform distribution. It is built for developers who maintain blogs, document projects, and want their content accessible via API in their own portfolio or site — without copy-pasting across platforms.

## 3. Problem statement

Developers who write face a fragmented workflow: writing in one place, manually republishing to Dev.to, Hashnode, and Medium, copy-pasting into their portfolio, and managing SEO metadata by hand. Whitepapper solves this by being the single source of truth for your content, with distribution and API access built in.

## 4. Ideal users and buyers

- Developers who maintain a blog or document their projects publicly.
- Indie makers who want their writing on their portfolio site via API.
- Builders who publish across Dev.to, Hashnode, and Medium regularly.
- Solo founders and students running lean content operations without a team.

## 5. Core entities (domain model)

Hierarchy: **Project > Collection > Paper**

- **User**: account owner with access to dashboard and all owned content.
- **Project**: top-level workspace with branding, API key scope, collections, and papers.
- **Collection**: optional grouping for thematic or structured content sets within a project.
- **Paper**: the core content unit. Markdown content with title, metadata, thumbnail, and distribution state. Papers can be standalone inside or outside a project.
- **API Key**: one key per project, scoped to that project. Used for external read access.

## 6. Core product capabilities

- Markdown-first writing with a minimal, distraction-free editor.
- Project and collection-based content organization.
- SEO defaults: title, description, canonical, Open Graph, Twitter metadata — automated.
- Public content surfaces for blogs, resources, updates, docs, integrations, legal pages.
- Developer API for reading project, collection, and paper data externally.
- One API key per project, read-oriented and safe for public-facing frontends.
- Multi-platform distribution: direct publish to Hashnode and Dev.to via their APIs, Medium via Import Tool URL.
- Markdown export available for all papers.
- Edge caching via Cloudflare Workers for API responses and public pages (sub-100ms).
- Redis caching for dashboard data (smooth internal experience without stale reads).
- Dashboards always show live data. Cache is for public/API traffic only.
- Content visibility control: private papers are owner-only, public papers are open to all including API consumers.

## 7. Distribution channels

| Platform | Method | Status |
|---|---|---|
| Hashnode | Direct API publish | Live |
| Dev.to | Direct API publish | Live |
| Medium | Import Tool URL (Medium pulls content) | Live |
| Threads | Direct distribution | Pending platform approval |
| Reddit | Direct distribution | Pending platform approval |
| LinkedIn | Direct distribution | Pending platform approval |
| Markdown export | Manual export | Always available |

Use in copy as: "publish once, distribute everywhere."

## 8. Public site and documentation IA

- Home: value proposition and product showcases.
- Blogs: combined latest/resources listing view.
- Resources: educational and evergreen content.
- Updates: product and release updates.
- About: product story, stack, distribution, API overview.
- Docs:
  - /docs (Quickstart)
  - /docs/best-practices
  - /docs/advanced
- Integrations: connected publishing ecosystem.
- Contact page.
- Legal pages:
  - /privacy-policy
  - /terms-of-service

## 9. API and access model

### 9.1 Auth and authorization

- User auth: Clerk-based sign-in/sign-up/callback workflows.
- Developer API access: one project-scoped API key per project, passed via `x-api-key` header.

### 9.2 Current endpoint patterns

- Health and app domain endpoints exist in FastAPI.
- Owner-managed API key lifecycle:
  - GET /projects/{projectId}/api-key
  - POST /projects/{projectId}/api-key
  - PATCH /api-keys/{keyId}
  - DELETE /api-keys/{keyId}
- Dev content access (read-oriented):
  - GET /dev/projects?id={projectId}
  - GET /dev/projects?slug={projectSlug}
  - Additional dev endpoints for project/collection/paper retrieval by id or slug.

### 9.3 API positioning

- Read-only for external usage. Safe to use in public-facing frontends.
- One key per project. Keys are scoped and revocable.
- Responses cached at the edge via Cloudflare Workers for sub-100ms delivery.
- API surface will expand as distribution and publishing features mature.

## 10. Performance architecture

- **Edge layer**: Cloudflare Worker reverse-proxies and caches API responses and public pages. Readers anywhere in the world get responses in under 100ms.
- **Dashboard layer**: Redis caches entity data (projects, collections, papers) for smooth internal reads. Dashboards always reflect live data — Redis is not used to serve stale dashboard state.
- **Backend**: FastAPI on Google Cloud Run. Scales to zero when idle.
- **Database**: Firestore for content and entity storage.

## 11. Full technology stack

### 11.1 Frontend app (astro/)

- Framework/runtime:
  - Astro 6 (ships near-zero JS to browser by default, best-in-class Core Web Vitals)
  - React 19 (islands inside Astro)
  - Vite 6
  - TypeScript 5
- Styling/UI:
  - Tailwind CSS 4
  - tw-animate-css
  - class-variance-authority, clsx, tailwind-merge
  - shadcn, Radix UI primitives
- Content/rendering/editor:
  - markdown-it, react-markdown, remark-gfm
  - @gravity-ui/markdown-editor
  - @diplodoc/transform
- Auth and deployment:
  - @clerk/astro
  - @astrojs/vercel

### 11.2 Backend API app (fastapi/)

- FastAPI 0.135.1 + Uvicorn
- Pydantic 2, pydantic-settings, python-dotenv
- clerk-backend-api, svix (webhooks)
- firebase-admin, redis, Pillow, python-multipart, groq

### 11.3 Edge/proxy layer (cloudflare-proxy/)

- Cloudflare Worker (JavaScript runtime)
- Reverse proxy to upstream Cloud Run URL
- GET response caching via caches.default

### 11.4 Architecture pattern

- Monorepo: frontend (Astro) + backend (FastAPI) + edge proxy (Cloudflare Worker)
- Frontend: SEO/public pages and authenticated dashboard
- Backend: domain APIs and auth-connected workflows, deployed on Google Cloud Run
- Edge worker: proxying, caching, routing control

## 12. Operator and legal

- Built and maintained by **Abhraneel Dhar**, indie developer, Kolkata, India.
- Domain: whitepapper.antk.in (subdomain of antk.in)
- No payments currently. Free to use.
- Governed by Indian law (IT Act, 2000). Jurisdiction: Kolkata, West Bengal.
- Privacy Policy and Terms of Service available at /privacy-policy and /terms-of-service.

## 13. SEO and content positioning

### 13.1 Positioning pillars

- SEO-first content engine for developers.
- Developer-friendly CMS with a read API safe for portfolio use.
- Multi-channel publishing from a single markdown source.
- Edge-cached, fast by default — no extra configuration needed.
- Minimal UI designed for zero cognitive overhead.

### 13.2 Blog content clusters

- **Cluster 1 (developer workflow)**: targeting devs actively looking for a Whitepapper-type solution.
- **Cluster 2 (technical deep-dives)**: Cloudflare Workers, Astro, FastAPI+Firestore, Redis caching.
- **Cluster 3 (SEO and content ops)**: headless blog API, developer CMS, content distribution workflow.
- **Cluster 4 (indie builder / build-in-public)**: personal story, solo shipping, college indie dev.

### 13.3 Keywords and topic clusters

- "developer CMS"
- "headless blog API"
- "markdown publishing platform"
- "publish to Dev.to Hashnode Medium"
- "content API for portfolio"
- "multi-channel content distribution"
- "SEO content workflow"
- "Astro blog with API"

## 14. Brand and voice guidance

- Tone: practical, direct, builder-focused. Personal on about/blog pages, not corporate.
- Voice: confident, honest about product state, no AI slop or LinkedIn fluff.
- Messaging style: show outcomes first (speed, no copy-paste, API access), then mechanism.
- Avoid: "revolutionize", "seamless", "game-changer", em dashes, filler superlatives.

## 15. Competitive framing

Whitepapper is not:
- A bloated CMS like WordPress or Ghost.
- A docs-only tool.
- A social media scheduler.

It is a unified content layer for developers: write in markdown, expose via API, distribute to every platform you publish on.

## 16. Current constraints and maturity notes

- Threads, Reddit, and LinkedIn distribution pending platform approvals.
- API is currently read-oriented for external use.
- No payments or paid tiers yet.
- Product is live, actively maintained, and used in production by the builder.

## 17. Short reusable pitch variants

- Whitepapper is a markdown-first CMS with a developer API and built-in distribution to Dev.to, Hashnode, and Medium.
- Write once in Whitepapper. Serve it via API to your portfolio. Publish it everywhere else in one click.
- Whitepapper gives developers a fast, structured content workflow with edge-cached API access and zero copy-paste distribution.