# Whitepapper - Complete App Context

Use this file as the canonical source of truth for content generation (SEO pages, blog posts, social content, ads, docs, sales collateral, onboarding copy, and product messaging).

## 1. Product in one line

Whitepapper is an SEO-first content operating system for creators, startups, and teams to plan, write, optimize, publish, and distribute content from one platform.

## 2. Product summary

Whitepapper combines a markdown-first editor, project-based content architecture, SEO metadata defaults, publishing workflows, and API-driven access. It is built for high-output content operations where speed, structure, and distribution matter.

## 3. Problem statement

Most content teams use fragmented tools for writing, collaboration, metadata, publishing, and distribution. This causes:

- slow publishing cycles,
- inconsistent SEO implementation,
- duplicated manual work across channels,
- weak governance over content assets.

Whitepapper solves this by centralizing content workflows and shipping SEO-ready outputs by default.

## 4. Ideal users and buyers

- Indie makers and solo creators publishing technical or product content.
- Startup marketing teams running lean content operations.
- Developer-first companies needing markdown and API workflows.
- Agencies managing content for multiple clients/projects.
- Product and growth teams repurposing long-form content into multi-channel posts.

## 5. Core entities (domain model)

- User: account owner/member with access to dashboard and workspace tools.
- Project: top-level workspace with branding, API key scope, collections, and papers.
- Collection: optional grouping for thematic/structured content sets.
- Paper: markdown content unit with title, metadata, thumbnail, and distribution state.
- API Key: project-scoped key for developer/dev endpoints and external consumption.

## 6. Core product capabilities

- Project-based content management (papers + collections).
- Markdown-first writing and rendering pipeline.
- SEO defaults for title, description, canonical, Open Graph, Twitter metadata.
- Public content surfaces for blogs, resources, updates, docs, integrations, legal.
- Dashboard workflows for create/edit/manage operations.
- API-key based developer access for read workflows.
- Multi-platform distribution direction for social/community channels.

## 7. Public site and documentation IA

- Home: value proposition and product showcases.
- Blogs: combined latest/resources listing view.
- Resources: educational and evergreen content.
- Updates: product and release updates.
- Docs:
	- /docs (Quickstart)
	- /docs/best-practices
	- /docs/advanced
- Integrations: connected publishing ecosystem.
- About and Contact pages.
- Legal pages:
	- /privacy-policy
	- /terms-of-service

## 8. API and access model

### 8.1 Auth and authorization

- User auth: Clerk-based sign-in/sign-up/callback workflows.
- Developer API access: project-scoped API key via x-api-key header.

### 8.2 Current endpoint patterns

- Health and app domain endpoints exist in FastAPI (for users/projects/etc.).
- Owner-managed API key lifecycle:
	- GET /projects/{projectId}/api-key
	- POST /projects/{projectId}/api-key
	- PATCH /api-keys/{keyId}
	- DELETE /api-keys/{keyId}
- Dev content access (read-oriented):
	- GET /dev/projects?id={projectId}
	- GET /dev/projects?slug={projectSlug}
	- Additional dev entity endpoints are present for project/collection/paper retrieval by id/slug.

### 8.3 API positioning

- Current API posture is read-first for external usage.
- Keys are project-scoped and designed for controlled exposure.
- API surface is expected to expand as distribution/publishing matures.

## 9. Integrations and distribution targets

Planned/active ecosystem direction includes:

- Hashnode
- Dev.to
- Reddit
- Threads
- Peerlist
- Substack
- LinkedIn
- X (Twitter)
- Medium

Use in copy as: "multi-channel distribution from one content source."

## 10. Full technology stack

### 10.1 Frontend app (astro/)

- Framework/runtime:
	- Astro 6
	- React 19 (islands inside Astro)
	- Vite 6
	- TypeScript 5
- Styling/UI:
	- Tailwind CSS 4
	- tw-animate-css
	- class-variance-authority
	- clsx
	- tailwind-merge
	- shadcn package usage
	- Radix UI primitives (@radix-ui/react-popover, @radix-ui/react-tabs)
- Content/rendering/editor ecosystem:
	- markdown-it
	- react-markdown
	- remark-gfm
	- @gravity-ui/components
	- @gravity-ui/uikit
	- @gravity-ui/markdown-editor
	- @diplodoc/transform
- Auth and deployment integration:
	- @clerk/astro
	- @astrojs/react
	- @astrojs/vercel
- Icons and UX helpers:
	- lucide-react
	- sonner

### 10.2 Backend API app (fastapi/)

- API framework and server:
	- FastAPI 0.135.1
	- Uvicorn[standard] 0.41.0
- Validation/config:
	- Pydantic 2.12.5
	- pydantic-settings 2.13.1
	- python-dotenv 1.2.2
- Auth/webhooks:
	- clerk-backend-api 5.0.2
	- svix 1.86.0
- Storage/services dependencies:
	- firebase-admin 7.2.0
	- redis 4.6.0
	- Pillow 12.1.1
	- python-multipart 0.0.22
	- groq

### 10.3 Edge/proxy layer (cloudflare-proxy/)

- Cloudflare Worker (JavaScript runtime).
- Wrangler config.
- Reverse proxy behavior to upstream CLOUD_RUN_URL.
- GET response caching via caches.default.

### 10.4 Architecture pattern

- Monorepo with separated frontend and backend apps plus edge proxy.
- Frontend serves SEO/public pages and authenticated app surfaces.
- Backend serves domain APIs and auth-connected workflows.
- Edge worker handles proxying/caching for performance and routing control.

## 11. SEO and content positioning

### 11.1 Positioning pillars

- SEO-first content engine.
- Developer-friendly content platform with API access.
- Multi-channel publishing/distribution workflow.
- Structured content ops for fast teams.

### 11.2 Content themes to generate

- SEO workflows and metadata automation.
- Content operations systems and editorial pipelines.
- Markdown + API-driven publishing strategy.
- Repurposing long-form content into social distribution.
- Technical comparisons: CMS vs headless vs workflow-first content systems.

### 11.3 Keywords and topic clusters (starter)

- "SEO content workflow"
- "developer CMS"
- "markdown publishing platform"
- "content operations software"
- "multi-channel content distribution"
- "headless content API"
- "startup content engine"
- "programmatic SEO content operations"

## 12. Brand and voice guidance

- Tone: practical, direct, builder-focused, not fluffy.
- Voice: confident, product-led, technical but accessible.
- Messaging style: show outcomes (speed, consistency, scale), then mechanism (workflow + SEO + API).
- Avoid: generic "AI magic" claims without workflow context.

## 13. Competitive framing (for content)

Whitepapper is not just:

- a simple blog CMS,
- a docs-only tool,
- or a social scheduler.

It is a unified content operating layer connecting creation, optimization, and distribution.

## 14. Use cases for generated content

- Product landing page sections.
- Feature pages (SEO, API, integrations, editor, distribution).
- Comparison pages.
- Top-of-funnel educational blog posts.
- Bottom-of-funnel "why Whitepapper" posts.
- Email onboarding and lifecycle sequences.
- Social thread and carousel scripts.
- Sales enablement one-pagers.

## 15. Current constraints and maturity notes

- Integration ecosystem is still evolving.
- API is currently read-leaning for external use.
- Some legal and policy copy is starter-level and can be expanded.
- Product capabilities are active and growing; keep claims aligned with implemented features.

## 16. Short reusable pitch variants

- Whitepapper helps teams publish SEO-ready content faster from one structured workflow.
- Whitepapper is a markdown-first, API-ready content engine with built-in SEO defaults.
- Whitepapper turns scattered content operations into one system for writing, optimization, and distribution.