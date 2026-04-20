# Whitepapper App Context

Use this file as the full product context source for strategy, marketing, metadata writing, onboarding copy, docs planning, and campaign messaging.

## Purpose

Whitepapper exists to remove content fragmentation for developers and builder teams.

One source of truth should be enough: write once in markdown, organize it cleanly, publish it on your own surface, distribute to external platforms, and serve it anywhere through API.

## Product One-Liner

Whitepapper is a markdown-first content platform for developers to write once, publish everywhere, and reuse content through a fast read API.

## Core Promise

- One place to create and manage content.
- One canonical source for all channels.
- One API-ready content layer for websites, portfolios, docs, and apps.
- Distribution workflows without repeated copy-paste.

## Main Users

- Indie developers maintaining technical blogs and project docs.
- Solo founders who need lightweight but structured content operations.
- Small startup teams shipping content without enterprise CMS overhead.
- Technical writers and makers who publish to multiple channels.

## Main Problems Solved

- Content is scattered across docs tools, publishing platforms, and private notes.
- Teams or individuals repeat formatting and republishing work manually.
- SEO metadata and canonical consistency are hard to keep clean across channels.
- Portfolio or app integrations require custom content plumbing every time.

## Domain Model

Primary hierarchy: Project -> Collection -> Paper

- User: workspace owner and authenticated operator.
- Project: top-level workspace with branding, API key scope, and content groups.
- Collection: optional grouping layer for related papers.
- Paper: markdown-first content unit with metadata, status, and visibility.
- API Key: project-scoped key for developer read access.

## Product Features

### Content Creation and Management

- Markdown-first editor focused on low-friction writing.
- Structured organization through projects and collections.
- Paper-level metadata and visibility controls.
- Markdown export for portability.

### SEO and Discovery

- Canonical URL support.
- Open Graph and Twitter metadata support.
- Robots controls and sitemap surfaces.
- Campaign-ready metadata layers per public page.

### Distribution

- Publish workflows for Dev.to and Hashnode (API-based).
- Medium distribution via import workflow.
- Additional channels planned (pending platform approvals).

### Developer API

- Project-scoped read API.
- Content fetch by ID and slug patterns.
- Suitable for portfolio sites, docs frontends, and custom apps.

### AI and MCP

- MCP server support for AI-assisted content workflows.
- Intended for IDE-native content operations via tools like Copilot/Claude/Cursor.

### Performance and Delivery

- Edge proxy with CDN caching for public/API responses.
- Fast global response behavior for frequently read pages.
- Dashboard remains live-data oriented, not stale-cache driven.

## Public Site Pages

### Core Marketing and Product Pages

- /
- /about
- /features
- /integrations
- /components
- /pricing
- /contact

### Content Surfaces

- /blogs
- /blogs/[slug]
- /updates
- /resources
- /docs
- /docs/[...slug]
- /compare
- /compare/[slug]
- /use-cases
- /use-cases/[slug]
- /glossary
- /glossary/[slug]

### Authenticated Product Experience

- /login
- /sign-in
- /sign-up
- /welcome
- /dashboard
- /dashboard/[projectId]
- /dashboard/[projectId]/[collectionId]
- /settings
- /write/[id]

### Account and Public Profile/Project Routes

- /[handle]
- /[handle]/[slug]
- /[handle]/p/[projectSlug]

### Utility and Infra Pages

- /404
- /unauthorized
- /privacy-policy
- /terms-of-service
- /robots.txt
- /rss.xml
- /sitemap.xml
- /sitemap-index.xml
- /sitemaps/public-pages.xml
- /sitemaps/public-projects.xml
- /sitemaps/public-papers.xml
- /sitemaps/docs-pages.xml
- /llms.txt
- /llms-full.txt

## Distribution Channels and Status

- Dev.to: live integration flow.
- Hashnode: live integration flow.
- Medium: import flow supported.
- Threads: pending rollout/approval.
- Reddit: pending rollout/approval.
- LinkedIn: pending rollout/approval.

## Access and Auth Model

- User auth handled through Clerk-based flow.
- Developer API uses project-scoped API keys.
- API keys are revocable and intended for read access patterns.

## Architecture Summary

- Frontend app for marketing pages, docs surfaces, and dashboard UX.
- Backend app for auth-aware domain APIs and content workflows.
- Edge proxy for domain mapping and CDN caching.

## Positioning

Whitepapper is a developer-first content operating layer.

It is not trying to be:

- A general drag-and-drop website builder.
- A heavy enterprise editorial suite.
- A social-media scheduling-only tool.

It is focused on:

- Markdown-based authoring.
- API-first reuse.
- Multi-channel publishing from one source.
- Clean SEO and metadata hygiene by default.

## Brand and Voice Direction

- Tone: direct, practical, builder-focused.
- Voice: clear and specific, no hype language.
- Messaging pattern: outcome first, implementation second.
- Avoid fluffy claims and generic AI/marketing filler.

## Campaign Messaging Anchors

- Write once, distribute everywhere.
- One source of truth for developer content.
- API-first content reuse for portfolio and product surfaces.
- SEO-ready publishing without repetitive setup overhead.

## Current Constraints

- Some distribution channels are still pending approvals.
- External API surface is currently read-oriented.
- Pricing/paid tier mechanics are not yet activated.
- Edge routing for some realtime endpoints remains intentionally restricted until token handling is hardened.

## Short Reusable Pitches

- Whitepapper helps developers write once and distribute everywhere from one markdown-first workspace.
- Whitepapper is a content source-of-truth platform with API-ready delivery and cross-platform publishing workflows.
- Whitepapper combines markdown authoring, metadata control, API reuse, and distribution into one developer-focused content system.