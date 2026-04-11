# Whitepapper Website Improvement Plan

*Audit date: 2026-04-12*

This plan was made after checking the repo, the current Astro app, the public site, the live sitemap files, the live `robots.txt`, the live `llms.txt`, the rendered HTML of key pages, and the current build output.

Skills used for this audit:
- `product-marketing-context`
- `seo-audit`
- `site-architecture`
- `schema-markup`
- `ai-seo`

Skipped on purpose:
- `frontend-design`

## 1. What this site is

Whitepapper is a hybrid site.

It is doing all of these jobs at the same time:
- Product marketing site
- Blog and resources hub
- Documentation site
- Public content platform for user papers and projects
- Components showcase

That is fine, but right now the site structure, metadata, and crawl rules do not treat these parts as one clear system. Because of that, search engines and AI systems can understand some parts of the site, but not the whole site as cleanly as they should.

## 2. Quick summary in simple English

The biggest problems right now are:
- Some blog pages show the right article on the page, but the browser title and social metadata still say `Untitled Paper`.
- The same content exists at both `/blogs/...` and `/{handle}/...`, and both URLs say they are the main version. This creates duplicate-content confusion.
- The sitemap includes at least one dead URL and also includes low-value URLs and text files that should not be in the main sitemap.
- The docs pages reuse generic titles like `Overview`, so many docs pages compete with each other for clicks and relevance.
- Public pages have SEO gaps like multiple H1 tags, broken placeholder links, missing image alt text, and generic metadata on some sections.
- The site already has schema and `llms.txt`, which is good, but some schema is incomplete or not aligned with visible content.
- The site needs a clearer page architecture if the goal is better rankings, better click-through rate, better crawling, and better AI citations.

## 3. Main findings

### 3.1 Duplicate URL problem on blog content

Current behavior:
- A blog article is available at `/blogs/{slug}`
- The same article is also available at `/{handle}/{slug}`
- Both pages return `200`
- Both pages use a self-canonical tag instead of pointing to one preferred version

Why this is a problem:
- Google can split ranking signals across both URLs
- Search engines may index the wrong version
- AI systems can cite different URLs for the same content
- Internal links, RSS, and sitemaps become inconsistent

Example from the live site:
- `/blogs/paper-20491f39-fcff-4683-9c01-d856dab87b9f`
- `/abhraneeldhar7/paper-20491f39-fcff-4683-9c01-d856dab87b9f`

What should happen:
- Pick one public canonical URL for editorial blog content
- Make the other URL either:
  - redirect with `301`, or
  - keep it live but canonicalize to the preferred blog URL

Recommended choice:
- Use `/blogs/{slug}` as the main URL for Whitepapper-owned editorial content
- Keep `/{handle}/{slug}` for user-owned public papers only

### 3.2 Blog metadata is sometimes wrong or too generic

Current behavior:
- The visible H1 can be correct
- But the `<title>`, Open Graph title, and descriptions can still say `Untitled Paper`
- Some descriptions are generic filler, not written for real search intent

Why this is a problem:
- Click-through rate drops because the search result does not match the page topic
- Relevance drops because the title tag is one of the strongest signals on the page
- Social sharing previews become weak
- AI systems see low-quality metadata and weak entity clarity

Example from the live site:
- H1: `How to Write Content That AI Assistants Actually Quote`
- Title tag: `Untitled Paper - by Abhraneel | Whitepapper`

This is one of the highest-priority fixes in the whole plan.

### 3.3 Docs titles are too generic and repeated

Current behavior:
- Many docs pages use page titles like `Overview | Whitepapper Docs`
- The word `Overview` appears many times across the docs section

Why this is a problem:
- Duplicate or near-duplicate titles reduce clarity
- Search results become hard to tell apart
- Users are less likely to click because the result title is vague
- Search engines get weaker context for the exact topic of each page

Example:
- `Overview | Whitepapper Docs`
- `Overview | Whitepapper Docs`
- `Overview | Whitepapper Docs`

Recommended pattern:
- `SEO Overview | Whitepapper Docs`
- `Dev API Overview | Whitepapper Docs`
- `Editor Overview | Whitepapper Docs`
- `Self-Host Overview | Whitepapper Docs`

### 3.4 Sitemap quality needs cleanup

Current behavior:
- `sitemap.xml` is a sitemap index
- `sitemap-index.xml` is also a sitemap index
- `sitemap.xml` points to `sitemap-index.xml`
- `public-pages.xml` includes `llms.txt` and `llms-full.txt`
- `public-papers.xml` includes a dead URL that returns `404`
- `docs-pages.xml` uses the current request time as `lastmod` for every docs page

Why this is a problem:
- Duplicate sitemap index endpoints add unnecessary confusion
- Non-page assets in the main page sitemap are not useful for normal search indexing
- A 404 URL in sitemap is a crawl-quality issue
- Fake `lastmod` values reduce trust in the sitemap data

Example of the dead sitemap URL:
- `https://whitepapper.antk.in/abhraneeldhartrexgaming/test-markdown`

Recommended fix:
- Keep one main sitemap index URL only
- Remove text files from `public-pages.xml`
- Remove 404 URLs from sitemaps
- Remove accidental or low-quality public URLs if they should not be indexable
- Use real update timestamps for docs pages

### 3.5 Multiple H1 tags exist on public pages

Current behavior:
- Many public pages have the main page H1
- The footer also uses an `h1` for the brand name

Why this is a problem:
- It weakens heading hierarchy
- It sends mixed signals about the primary page topic
- It is unnecessary and easy to fix

Verified on live pages:
- Homepage has 2 H1 tags
- Blog post pages have 2 H1 tags
- Docs pages have 2 H1 tags

Recommended fix:
- Change the footer brand heading to `p`, `div`, or `h2`
- Keep exactly one main H1 per page

### 3.6 Some public pages are crawlable but not fully optimized

Current behavior:
- `/components` and `/components/{component}` are public
- They are linked from navigation
- They have canonical URLs
- But they fall back to a generic default description
- They are not included in the public pages sitemap

Why this is a problem:
- Search engines can find them through links, but the pages are not clearly supported as an SEO section
- Metadata is too generic to rank well
- The section is floating outside the main site architecture

Recommended decision:
- Choose one of these paths:
  - Treat components as a real public SEO section and optimize it fully
  - Move components under docs, like `/docs/components/...`
  - Mark the section `noindex` if it is not a traffic priority

### 3.7 Internal links are weak in some content

Current behavior:
- Some blog posts contain `href="#"` placeholder links in the published HTML
- Related links are present visually but do not go to real destination pages

Why this is a problem:
- Users hit dead links
- Crawlers cannot follow those links
- Internal linking signals are lost
- AI systems cannot move from one supporting document to another

Example:
- One live GEO article contains 6 placeholder `#` links

Recommended fix:
- Replace every placeholder link with a real URL
- If the target page does not exist yet, remove the link until it does

### 3.8 Image alt text is missing in many places

Current behavior:
- Many `img` elements across public components and pages do not include useful `alt` text
- Some images use empty alt when they are not purely decorative

Why this is a problem:
- Accessibility drops
- Image search value drops
- AI and search systems get less context from image content

Recommended fix:
- Add descriptive alt text to every content image
- Use empty alt only for fully decorative images

### 3.9 Schema markup exists, but some parts need improvement

Good things already in place:
- Homepage has JSON-LD
- Blog pages have `BlogPosting`
- Docs pages have `TechArticle`
- Breadcrumb schema exists
- `llms.txt` and `llms-full.txt` exist

Problems:
- Homepage includes `FAQPage` schema, but the FAQ content is not visibly present on the page
- Some article schema values are generic or low-quality
- `wordCount` is `0` in article schema
- Docs schema is missing stronger author, date, and section context
- Organization schema is minimal and does not fully support entity understanding

Why this matters:
- Rich result eligibility depends on accurate markup
- Search engines do not like schema that does not match visible page content
- AI systems benefit from better entity and page relationships

Recommended fix:
- Only keep FAQ schema where the FAQ is visible on the page
- Calculate and store real word count
- Add stronger organization and website schema
- Improve article, docs, project, and collection schema with more complete fields

### 3.10 Brand/entity consistency is still weak

Current behavior:
- The product is clearly described in some places
- But there is still inconsistency between:
  - page titles
  - visible author labels
  - metadata author names
  - canonical URL choices
  - old `Whitepaper` vs `Whitepapper` wording in some content

Why this is a problem:
- GEO depends on clean entity consistency
- AI tools trust brands more when names, descriptions, and URLs stay stable
- Inconsistent naming makes citations weaker

Examples:
- Blog metadata can say `Untitled Paper`
- Visible author on blog pages can say `Whitepapper`
- Metadata author can say `Abhraneel`

Recommended fix:
- Define one brand entity style guide
- Decide when content is:
  - product editorial content by Whitepapper
  - personal content by Abhraneel
  - public user-generated content
- Reflect that same choice in on-page author box, metadata, schema, and canonical URL

### 3.11 Performance is good in some areas, but there are clear improvement opportunities

Good signs:
- The homepage is cached
- Astro server rendering keeps pages crawlable
- Images are already using `astro:assets` in some important places

Performance concerns found:
- Public pages include Clerk auth scripts even when the user is signed out and just reading marketing or docs pages
- The site uses several client islands on docs and blog pages
- The production build warns about large JS chunks
- The biggest built asset is very large:
  - `textEditor` bundle is about 2.4 MB
- Several syntax/highlighting chunks are also large
- Fonts and some images are still heavy enough to optimize further

Why this matters:
- Core Web Vitals affect rankings and user experience
- Large JS hurts slower devices most
- Public pages should stay as light as possible

Recommended fix:
- Split public layout from auth-heavy layout
- Only load Clerk where it is really needed
- Reduce editor and syntax highlighter payloads
- Keep docs/blog pages mostly server-rendered with lighter hydration

### 3.12 The site is missing several high-value SEO and GEO pages

Current public structure is missing obvious demand-capture pages like:
- Feature pages
- Use-case pages
- Comparison pages
- Alternatives pages
- Pricing page
- Machine-readable pricing file
- Glossary pages
- Entity-proof pages

Why this is a problem:
- The site has good technical content, but not enough high-intent commercial or comparison content
- AI systems often cite pages that define, compare, or explain categories clearly
- Search CTR improves when pages match buyer intent directly

Recommended additions:
- `/pricing`
- `/pricing.md`
- `/features`
- `/features/content-api`
- `/features/distribution`
- `/features/seo-metadata`
- `/use-cases/developer-blog`
- `/use-cases/portfolio-content-api`
- `/use-cases/devrel-content-ops`
- `/compare/whitepapper-vs-ghost`
- `/compare/whitepapper-vs-hashnode`
- `/compare/whitepapper-vs-devto-workflow`
- `/glossary/llms-txt`
- `/glossary/canonical-url`
- `/glossary/programmatic-seo`

## 4. Recommended target site structure

Use this as the long-term page hierarchy.

```text
Homepage (/)
|-- Product (/product or keep key product sections on /)
|-- Features (/features)
|   |-- Content API (/features/content-api)
|   |-- Distribution (/features/distribution)
|   |-- SEO Metadata (/features/seo-metadata)
|   |-- Public Pages (/features/public-pages)
|-- Use Cases (/use-cases)
|   |-- Developer Blog (/use-cases/developer-blog)
|   |-- Portfolio Content API (/use-cases/portfolio-content-api)
|   |-- Docs and Changelog Publishing (/use-cases/docs-and-updates)
|-- Integrations (/integrations)
|   |-- Dev.to (/integrations/devto)
|   |-- Hashnode (/integrations/hashnode)
|   |-- Medium (/integrations/medium)
|-- Pricing (/pricing)
|-- Blog (/blogs)
|   |-- Updates (/updates)
|   |-- Resources (/resources)
|   |-- Editorial Articles (/blogs/{slug})
|-- Docs (/docs)
|   |-- Getting Started
|   |-- Core Concepts
|   |-- SEO
|   |-- Dev API
|   |-- Distribution
|   |-- Self Host
|-- Components
|   |-- Keep as /components if it is a growth section
|   |-- Or move under /docs/components if it is support content
|-- About (/about)
|-- Contact (/contact)
|-- Legal
|   |-- Privacy Policy (/privacy-policy)
|   |-- Terms of Service (/terms-of-service)
|-- Public Profiles (/{handle})
|-- Public Projects (/{handle}/p/{projectSlug})
|-- Public User Papers (/{handle}/{slug})
```

## 5. Detailed implementation plan

## Phase 0: Set the rules before changing pages

Goal:
- Make sure every later SEO change follows one clear system

Tasks:
- Create and keep one source of truth for product positioning
- Decide which content types belong to:
  - Whitepapper editorial content
  - docs content
  - public user content
  - component showcase content
- Decide the canonical URL rule for each content type
- Decide which sections are indexable and which are not

Repo files to update:
- `.agents/product-marketing-context.md`
- `appInfo.md`
- Any content model docs that define public page behavior

Definition of done:
- Every page type has a clear answer for:
  - What is this page for?
  - Should it rank?
  - What should its canonical URL be?
  - Which schema should it use?

## Phase 1: Fix crawl and indexation problems first

Goal:
- Remove confusion for search engines

Tasks:
- Choose one main sitemap index endpoint
- Redirect or standardize the other sitemap index endpoint
- Remove `llms.txt` and `llms-full.txt` from the normal page sitemap
- Keep those files discoverable from `robots.txt` and internal references, not as normal indexable page URLs
- Remove any 404 URL from `public-papers.xml`
- Add a sitemap validation step in deployment
- Stop using `new Date().toISOString()` as the docs sitemap `lastmod`
- Use a real date source:
  - markdown frontmatter `updatedAt`
  - git commit date
  - file modified time during build

Repo files to update:
- `astro/src/pages/sitemap.xml.ts`
- `astro/src/pages/sitemap-index.xml.ts`
- `astro/src/pages/sitemaps/public-pages.xml.ts`
- `astro/src/pages/sitemaps/docs-pages.xml.ts`
- `astro/src/pages/sitemaps/public-papers.xml.ts`
- backend SEO endpoints if the bad URLs come from API data

Also do this:
- Add a daily or deploy-time sitemap QA script
- Fail deployment if sitemap contains:
  - 404 URLs
  - duplicate URLs
  - non-canonical URLs
  - low-quality test pages

Definition of done:
- One clear sitemap index
- No dead URLs in sitemap
- No non-page assets in page sitemap
- Real `lastmod` values

## Phase 2: Fix canonical URL logic and duplicate content

Goal:
- Make every content item have one clear ranking URL

Tasks:
- Separate editorial blog content from user content in URL policy
- For Whitepapper editorial content:
  - keep `/blogs/{slug}` as canonical
  - redirect or canonicalize the handle-based version to `/blogs/{slug}`
- For user-owned public papers:
  - keep `/{handle}/{slug}` as canonical
  - do not clone them into `/blogs`
- Update RSS feed links to match the real canonical URL
- Update sitemap entries to match the same canonical rule
- Make internal links point only to the canonical version

Repo files to update:
- `astro/src/metadata/dynamic.ts`
- `astro/src/pages/blogs/[slug].astro`
- `astro/src/pages/[handle]/[slug].astro`
- `astro/src/pages/rss.xml.ts`
- related backend SEO feed endpoints

Definition of done:
- The same article is no longer indexable at two self-canonical URLs
- RSS, sitemap, canonical tag, schema, and internal links all agree

## Phase 3: Fix title tags, meta descriptions, and CTR issues

Goal:
- Make search results clearer and more clickable

Tasks for blog pages:
- Never let the title tag fall back to `Untitled Paper` on a published article
- Use the real paper title from content first
- If a title is missing, block publishing or show a strong validation warning
- Generate meta descriptions from real article summaries, not generic filler
- Keep titles human-readable and keyword-first where natural

Tasks for docs:
- Replace generic titles like `Overview`
- Include section context in titles and H1s

Better pattern examples:
- `SEO Overview | Whitepapper Docs`
- `Dev API Authentication | Whitepapper Docs`
- `Self-Host Production Checklist | Whitepapper Docs`

Tasks for marketing pages:
- Improve generic one-word titles where needed
- Make homepage title more descriptive if branded demand is still low
- Make `/blogs`, `/resources`, `/updates`, `/integrations`, and `/about` more specific in title and OG title

Tasks for components:
- Add dedicated metadata files or inline SEO config
- Stop using the generic default description on those pages

Repo files to update:
- `astro/src/metadata/dynamic.ts`
- `astro/src/metadata/pages/*.json`
- `astro/src/pages/components.astro`
- `astro/src/pages/components/[component].astro`
- docs page data source in `astro/src/content/docs/docsPagesStructure.ts`

Definition of done:
- No important page has a generic or wrong title tag
- No important page has a weak fallback description
- Docs titles are unique and clear

## Phase 4: Fix heading structure and visible content quality

Goal:
- Make pages easier for crawlers and users to understand

Tasks:
- Remove the extra footer `h1`
- Keep one main H1 on each page
- Add visible section headings that better match real search intent
- Improve the homepage so the first screen explains:
  - what Whitepapper is
  - who it is for
  - why it is different
- Add a short FAQ section to the homepage if you want to keep homepage FAQ schema
- Add visible summaries at the top of docs pages when helpful

Repo files to update:
- `astro/src/components/footer.astro`
- homepage and major landing pages
- docs shell or docs markdown files if section intros need work

Definition of done:
- One H1 per page
- Strong answer-first introductions on priority pages

## Phase 5: Fix broken internal links and improve internal linking

Goal:
- Help both crawlers and users move through the site

Tasks:
- Remove every `href="#"` from published content
- Replace placeholder links with real URLs
- Add "related reading" blocks on blog posts
- Add links from blog posts into:
  - docs
  - feature pages
  - integrations pages
  - use-case pages
- Add links from docs back to product pages where relevant
- Add links from integrations pages to docs and editorial articles
- Add links from homepage to the most important commercial and educational pages

Recommended internal linking model:
- Home links to features, use cases, docs, blog, integrations, pricing
- Blog posts link to one relevant feature page and one docs page
- Docs pages link to relevant product pages and resources
- Comparison pages link to pricing, features, and migration docs

Repo files to update:
- blog content in the CMS data
- docs markdown files
- homepage and navigation components

Definition of done:
- No placeholder links in live content
- Every important page has inbound internal links
- Content clusters connect clearly

## Phase 6: Improve schema markup properly

Goal:
- Help Google and AI systems understand the site better

Tasks for homepage:
- Keep `WebSite`
- Improve `Organization`
- Only keep `FAQPage` if the FAQ is visibly present on the page
- Add logo and sameAs fields if real profiles exist

Tasks for docs:
- Keep `TechArticle`
- Add:
  - author
  - dateModified
  - section name
  - better breadcrumb names

Tasks for blog pages:
- Keep `BlogPosting`
- Calculate real `wordCount`
- Use the real published title and summary
- Add author data that matches the visible author box
- Use real datePublished and dateModified

Tasks for public papers and projects:
- Review whether `Article`, `CollectionPage`, and `ProfilePage` are the best fit
- Add more complete entity fields where available

Tasks for components section:
- If indexable, add:
  - `TechArticle` or `SoftwareSourceCode`
  - breadcrumb schema
  - component-specific metadata

Repo files to update:
- `astro/src/metadata/dynamic.ts`
- `astro/src/metadata/pages/home.json`
- `astro/src/components/docs/DocsPageShell.astro`
- component pages if they stay public and indexable

Definition of done:
- Schema matches visible page content
- No fake FAQ schema
- Articles and docs have complete, trustworthy structured data

## Phase 7: Improve GEO and AI citation readiness

Goal:
- Make Whitepapper easier to cite in AI answers

Tasks:
- Standardize the product definition across:
  - homepage
  - about page
  - docs intro
  - `llms.txt`
  - `llms-full.txt`
  - metadata descriptions
- Create a public pricing page even if the product is free today
- Add a machine-readable `/pricing.md`
- Add clearer author bios for editorial content
- Add visible "last updated" dates on docs and resource articles
- Add citation-worthy data where possible:
  - performance numbers
  - usage limits
  - platform support tables
  - implementation examples
- Add Q&A sections on priority pages
- Create comparison pages and alternatives pages
- Build glossary pages for technical publishing and SEO terms

Recommended new machine-readable files:
- `/pricing.md`
- maybe `/api-overview.md` if you want AI tools to parse feature structure more easily

Tasks for `llms.txt` and `llms-full.txt`:
- Keep them, because they are already a strong advantage
- Improve them with:
  - product category line
  - clearer "who it is for"
  - canonical product pages
  - pricing reference
  - feature and use-case links
  - docs sections that matter most

Definition of done:
- Whitepapper has a stable entity definition
- AI systems can reach high-value pages quickly
- Key product facts are easy to extract and cite

## Phase 8: Build high-intent SEO pages

Goal:
- Capture traffic that is closer to product adoption

Priority page groups:

### Group A: Feature pages
- `/features/content-api`
- `/features/distribution`
- `/features/seo-metadata`
- `/features/public-pages`

What each feature page should include:
- Clear definition in the first paragraph
- Who this feature is for
- Why it matters
- How it works in Whitepapper
- Screenshots
- FAQ
- related docs links
- schema

### Group B: Use-case pages
- `/use-cases/developer-blog`
- `/use-cases/portfolio-content-api`
- `/use-cases/docs-and-updates`

What each use-case page should include:
- Ideal reader
- problem
- workflow before Whitepapper
- workflow with Whitepapper
- example setup
- CTA

### Group C: Comparison pages
- `/compare/whitepapper-vs-ghost`
- `/compare/whitepapper-vs-hashnode`
- `/compare/whitepapper-vs-devto-workflow`

What each comparison page should include:
- fair comparison table
- differences by use case
- who each tool is better for
- pricing or plan clarity
- migration advice

### Group D: Glossary and topical authority pages
- `/glossary/llms-txt`
- `/glossary/canonical-url`
- `/glossary/programmatic-seo`
- `/glossary/content-api`

Why this matters:
- These pages support both normal SEO and AI retrieval
- They make the site easier to understand at the entity and topic level

## Phase 9: Improve blog and resources content quality

Goal:
- Turn existing articles into better ranking and citation assets

Tasks:
- Review all published articles for:
  - wrong title tags
  - generic summaries
  - empty or weak keywords
  - missing links
  - placeholder links
  - missing citations
  - missing FAQ blocks
  - inconsistent author naming
- Rewrite opening paragraphs so they answer the query faster
- Add real related links at the bottom of every article
- Add article series pages where helpful
- Remove or merge weak articles that do not have enough depth

Special cleanup list:
- Fix every published page that still shows `Untitled Paper`
- Decide whether generic slug-style content should stay public
- Remove or improve low-quality "test" and "untitled" public content

Definition of done:
- Every public article has:
  - a real title
  - a real summary
  - a clear search intent
  - real internal links
  - no placeholder links

## Phase 10: Improve docs for rankings and support traffic

Goal:
- Make docs rank better and also convert readers into product users

Tasks:
- Use unique titles and H1s
- Add short section labels above titles where useful
- Add stronger intro summaries for important docs pages
- Add "what you will learn" blocks
- Add "related product feature" blocks
- Add more descriptive breadcrumb labels
- Add real last updated dates to docs pages
- Use better schema fields on docs pages

Also do this:
- Decide if some docs pages should target search directly as landing pages
- If yes, expand them with:
  - definitions
  - FAQs
  - examples
  - screenshots
  - common errors

Definition of done:
- Docs pages are unique, search-friendly, and internally connected

## Phase 11: Performance improvements for public pages

Goal:
- Keep crawlable pages fast on real devices

High-priority tasks:
- Split the public layout from the auth layout
- Avoid loading Clerk scripts on marketing, docs, and blog pages unless truly needed
- Review whether `ClientRouter` is needed on every public page
- Keep client hydration only where it adds clear user value
- Defer or remove non-essential interactive islands
- Review TOC widgets on pages where they do not help enough

Medium-priority tasks:
- Reduce editor bundle size on app routes
- Limit syntax highlighting languages if possible
- Code-split heavy writing/editor features more aggressively
- Optimize large images and consider smaller responsive variants
- Check font loading strategy and preloading

Measured evidence from build output:
- `textEditor` bundle is about 2482 KB
- some language chunks are 600 KB to 760 KB range
- homepage hero image and some other large images still have room to shrink

Definition of done:
- Public pages load lighter JS
- app/editor routes are split more aggressively
- build no longer warns about major chunk size without explanation

## Phase 12: Tracking and monitoring

Goal:
- Know if the changes are working

Set up:
- Google Search Console
- Bing Webmaster Tools
- GA4 or another analytics tool
- monthly AI visibility tracking sheet

Track these:
- indexed pages
- pages excluded from indexing
- top queries
- CTR by page
- impressions by page
- Core Web Vitals
- 404 pages from crawl reports
- AI citation checks for priority queries

Monthly manual GEO checks:
- `developer cms`
- `markdown publishing platform`
- `content api for portfolio`
- `publish to dev.to hashnode medium`
- `llms.txt`
- `programmatic seo api first cms`

## 6. Page-by-page implementation notes

### Homepage
- Keep it indexable
- Add visible FAQ if you keep FAQ schema
- Improve the hero copy so the product definition is clearer
- Add links to features, use cases, pricing, and comparison pages
- Add stronger proof blocks

### `/blogs`
- Keep as the editorial blog hub
- Add stronger intro text and topic grouping
- Add pagination or category strategy if the section grows

### `/resources`
- Treat as evergreen educational content
- Add a better section intro
- Add clear internal links to product pages

### `/updates`
- Treat as product change log and release notes
- Keep these separate from evergreen resources
- Add release summaries and product impact notes

### `/docs`
- Keep as product documentation
- Improve section landing copy
- Use unique section-aware titles

### `/integrations`
- Expand into a real index with child pages
- Add per-platform pages if integrations are traffic targets

### `/components`
- Decide whether this is a growth section or support section
- If growth:
  - add sitemap coverage
  - add real metadata
  - add schema
- If support:
  - move under docs

### Public profile, project, and paper pages
- Keep only high-quality public pages indexable
- Remove or noindex accidental, test, or weak public pages
- Improve metadata validation at publish time

## 7. Suggested implementation order

Do the work in this order:

1. Fix sitemap and canonical problems
2. Fix wrong metadata on blog pages
3. Fix duplicate docs titles and H1 problems
4. Remove placeholder links and bad public URLs
5. Fix schema alignment
6. Improve internal linking
7. Add pricing and machine-readable files
8. Build new feature/use-case/comparison pages
9. Reduce public-page JS and auth overhead
10. Start monthly SEO and GEO monitoring

## 8. What should be done first this week

If you want the fastest improvement with the least effort, do these first:

1. Fix the `Untitled Paper` metadata problem on published blog pages
2. Fix canonical duplication between `/blogs/...` and `/{handle}/...`
3. Remove dead and low-quality URLs from `public-papers.xml`
4. Remove `llms.txt` files from `public-pages.xml`
5. Replace footer `h1`
6. Rename docs `Overview` titles so they are unique
7. Replace placeholder `#` links in published blog posts
8. Add proper metadata to `/components` pages or remove them from indexation

## 9. Final note

Whitepapper already has a better technical SEO base than many early-stage products.

The good news is:
- public HTML is crawlable
- schema already exists
- sitemaps already exist
- `llms.txt` already exists
- docs and content sections already exist

So this is not a "start from zero" project.

This is a "clean up the important mistakes, then make the site much easier to understand and trust" project.

If the first high-priority fixes are done well, Whitepapper should improve in:
- crawl clarity
- index quality
- click-through rate
- internal link flow
- AI citation readiness
- conversion intent alignment

