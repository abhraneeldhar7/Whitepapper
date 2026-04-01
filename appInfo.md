# Whitepapper - Product Overview

Whitepapper is an SEO-first content engine for teams and creators who need to create, manage, publish, and distribute content from one system.

## Product purpose

- Centralize long-form content production and metadata management.
- Enforce SEO-friendly publishing defaults across pages and APIs.
- Provide developer APIs for external apps and integrations.
- Distribute content across third-party platforms from a single workflow.

## Core app model

- User: account owner with access to dashboard, projects, papers, and settings.
- Project: top-level workspace with name, branding, API key, collections, and papers.
- Collection: optional grouping inside a project to organize related papers.
- Paper: markdown-based content item with title, thumbnail, metadata, and distribution state.

## Main feature set

- Project-based content management with standalone papers and collections.
- Markdown-first editing and rendering with rich preview support.
- Built-in SEO metadata workflow (titles, descriptions, social meta defaults).
- Publishing pipeline with integration-ready distribution flow.
- Public-facing pages for blogs, resources, updates, docs, legal, and integrations.
- Dashboard workspace for creating/editing/managing project content.

## Developer API (current)

Current API supports read workflows and project-level key usage.

- /dev/project: fetch project details.
- /dev/collection?id=COLLECTION_ID: fetch collection by id.
- /dev/collection?slug=COLLECTION_SLUG: fetch collection by slug.
- /dev/paper?id=PAPER_ID: fetch paper by id.
- /dev/paper?slug=PAPER_SLUG: fetch paper by slug.

Notes:

- API key model is project-scoped.
- Current usage is primarily GET/read-oriented.
- Additional API capabilities are expected to expand.

## Integrations (in progress)

Whitepapper includes and/or is actively building distribution integrations for:

- Hashnode
- Dev.to
- Reddit
- Threads
- Peerlist
- Substack
- LinkedIn
- X (Twitter)
- Medium

Integration status is not final and will evolve as publishing and scheduling pipelines mature.

## Docs and public experience

- Docs structure: Quickstart, Best practices, Advanced.
- Shared public site navigation across key pages.
- Legal pages (privacy policy and terms of service) rendered with a reusable legal document component.
- Metadata defaults applied across pages for baseline SEO and social previews.

## Internal/editor capabilities

- Built-in editor and markdown preview flow.
- Project and collection workspace screens for content operations.
- Export and content reuse tooling (including social post chunking).
- Reusable UI components (including table-of-contents variants and render helpers).

## Tech stack snapshot

- Frontend: Astro + React islands with Tailwind/shadcn-style component patterns.
- Backend: FastAPI service for app/domain APIs.
- Edge/proxy: Cloudflare worker layer for proxy/cache workflows.
- Auth: Clerk-based auth and callback flow.
- Data/services: project, collection, paper, and distribution service modules.

## SEO content context (for future generation)

Whitepapper should be positioned as:

- An SEO-first content operating system.
- A developer-friendly CMS with API access.
- A multi-channel publishing/distribution engine.
- A workflow tool for teams that need structured content production at scale.

Primary themes for future content:

- SEO workflows and metadata automation.
- Content operations and editorial systems.
- API-driven publishing and headless CMS usage.
- Multi-platform content distribution best practices.