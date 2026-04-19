# Distribution Pipeline, API Keys, and What We Shipped in v0.2

**Meta title:** Whitepaper v0.2  Distribution Pipeline, API Keys, and More  
**Meta description:** Whitepaper's second update ships cross-platform content distribution, per-project API keys, bulk export, and auto tweet conversion. Here's everything that's new.  
**Slug:** `/blog/whitepaper-v0-2-distribution-api-keys`  
**Category:** Updates  
**Published:** 2026-03-15

---

A few weeks in and we've shipped a lot. Here's everything that's new in v0.2, what we changed, and what's coming next.

---

## Content Distribution Pipeline

The biggest thing in this release: you can now cross-post directly from Whitepaper to six platforms in one click.

Supported right now:
- **Hashnode**  posts to your Hashnode publication via their API
- **Dev.to**  publishes as a new article under your Dev.to account
- **Reddit**  submits to a subreddit of your choice
- **Threads**  posts a summary thread
- **Peerlist**  publishes to your Peerlist profile
- **Substack**  sends as a new post to your newsletter

Each integration connects once via OAuth or API key. After that, distribution is a single action from your paper's publish screen.

We handle canonical URLs automatically. When cross-posting to Hashnode or Dev.to, Whitepaper sets the canonical back to your original paper URL on whitepaper.so. Your SEO credit stays with you, not the platform you cross-posted to.

---

## Per-Project API Keys

Every project now gets its own API key. Use it to fetch your content programmatically from your own apps, documentation sites, or portfolios.

Three endpoints available:

```
GET /dev/project
GET /dev/paper?id=PAPER_ID
GET /dev/paper?slug=PAPER_SLUG
GET /dev/collection?id=COLLECTION_ID
GET /dev/collection?slug=COLLECTION_SLUG
```

All endpoints are GET-only for now. Authentication is via the `X-Api-Key` header. Keys are scoped to a single project  one project, one key, clean separation if you're running multiple publications.

Full API reference is in the docs.

---

## Auto Tweet Conversion

Write a paper, click convert, get a thread. Whitepaper now automatically splits your article into chunked tweets sized for X's character limit, preserving the logical structure of your content rather than just cutting at 280 characters.

It's not perfect for every article  long technical posts with code blocks need a manual pass  but for opinion pieces and explanations it works well out of the box.

---

## Bulk Export

You can now export all papers in a project as a zip of Markdown files. Each file includes frontmatter with title, slug, published date, and tags.

Useful if you want a local backup, want to migrate content somewhere else, or want to feed your papers into a custom build pipeline.

---

## Free React Components

Two components are now available for anyone building on the Whitepaper API:

**Table of Contents  mobile island.** A floating, collapsible TOC for mobile readers. Generates from your paper's heading structure automatically.

**Table of Contents  desktop edge.** A fixed sidebar TOC for desktop. Highlights the current section as the reader scrolls.

Both are unstyled by default and accept a className prop for your own styling. Drop them into any React or Astro project.

---

## What We Fixed

- Slug normalization now strips leading `@` symbols and enforces lowercase on all public URLs
- Project pages no longer make a redundant API call to fetch the owner profile separately  it's included in the project payload
- Paper thumbnails now render with correct dimensions and alt text across all public pages
- Fixed an issue where collection papers were only loaded on accordion interaction, making them invisible to search crawlers

---

## What's Next

A few things we're actively working on:

**Writing UI.** A proper in-browser editor so you can write directly in Whitepaper without touching a local Markdown file. Rich text with Markdown shortcuts, image upload, and live preview.

**Project analytics.** Per-paper view counts, referrer breakdown, and distribution performance across platforms.

**More distribution targets.** LinkedIn and Medium are next on the list.

**Team access.** Multiple contributors on a single project, with role-based permissions.

---

If you're using Whitepaper and something is broken or something is missing, open an issue or reach out directly. We read everything.

More soon.
