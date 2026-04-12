export type PageLink = {
  href: string;
  label: string;
  description: string;
};

export type DetailPage = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  body: string;
  faq?: Array<{ question: string; answer: string }>;
  links?: PageLink[];
};

export const featurePages: DetailPage[] = [
  {
    slug: "content-api",
    eyebrow: "Feature",
    title: "Content API",
    description: "Use Whitepapper as the read API for blogs, docs, project pages, and developer portfolios.",
    body: `
Whitepapper gives every public project a read API so the same content can power your own frontend, public docs, and editorial pages without rebuilding the content model for every surface.

## What you get

- Project, collection, and paper endpoints designed for read-heavy frontend usage.
- Stable public page URLs that can match the same content returned by the API.
- A developer-friendly content model: projects at the top, collections for grouping, papers for the actual writing.

## Why it matters

If you already have a personal site, portfolio, or docs frontend, the API lets Whitepapper become your source of truth instead of just another place to paste content. You can keep your custom UI while centralizing the writing workflow.

## Best fit

This is a good fit for developers who want:

- a markdown-first CMS instead of a visual page builder
- one place to manage articles, docs, updates, and project writing
- public, crawlable pages alongside a reusable content API

## Next steps

Read the [Dev API overview](/docs/dev-api/overview), then move to [contracts](/docs/dev-api/contracts) or the [portfolio content API use case](/use-cases/portfolio-content-api).
`,
    faq: [
      {
        question: "Can I use the Content API on my own frontend?",
        answer: "Yes. Whitepapper is built for that model. The API is read-oriented, project-scoped, and designed to feed public-facing sites.",
      },
      {
        question: "Do I still get public pages if I use the API?",
        answer: "Yes. The API and the public pages can coexist, so you can use Whitepapper as both a publishing source and a public destination.",
      },
      {
        question: "Do I need to migrate my whole website to start?",
        answer: "No. Most teams start by connecting one project or section first, then expand once the API and workflow fit their setup.",
      },
    ],
    links: [
      { href: "/docs/dev-api/overview", label: "Dev API overview", description: "Start with the API model and project scoping." },
      { href: "/use-cases/portfolio-content-api", label: "Portfolio use case", description: "See the Content API in a portfolio workflow." },
      { href: "/glossary/content-api", label: "Glossary: Content API", description: "A short definition you can share with your team." },
    ],
  },
  {
    slug: "distribution",
    eyebrow: "Feature",
    title: "Distribution",
    description: "Publish once in Whitepapper, then distribute to Dev.to, Hashnode, and Medium import flows from the same source.",
    body: `
Whitepapper is built around one source of truth. You write the paper once, keep the original public URL on Whitepapper, and push the same content outward when you need reach on other platforms.

## Current distribution workflow

- **Dev.to** publishing through the API
- **Hashnode** publishing through the API
- **Medium** import using the Whitepapper public URL

## Why teams use it

Distribution is where content workflows usually fall apart. People rewrite titles, forget canonicals, or leave metadata inconsistent across platforms. Whitepapper keeps the workflow close to the original paper so you can move faster without losing ownership of the primary page.

## Canonical and metadata impact

Because Whitepapper stores the original public page and metadata together, it is easier to keep external distribution aligned with the source content. That matters for SEO, GEO, and simple operational sanity.

## Next steps

Read the [Distribution overview](/docs/distribution/overview), review [platform status](/docs/distribution/platform-status), and compare it with the [docs and updates use case](/use-cases/docs-and-updates).
`,
    faq: [
      {
        question: "Is Whitepapper trying to replace every publishing platform?",
        answer: "No. It is the source-of-truth layer. You can still use external channels for reach while keeping the original page under your control.",
      },
      {
        question: "Does distribution require me to publish publicly first?",
        answer: "For some workflows, yes. Medium import in particular depends on the original public URL.",
      },
      {
        question: "Can I distribute the same paper to multiple channels?",
        answer: "Yes. That is the point of the workflow: keep one original paper, then publish outward where it makes sense.",
      },
    ],
    links: [
      { href: "/docs/distribution/overview", label: "Distribution docs", description: "Understand the current distribution flow." },
      { href: "/compare/whitepapper-vs-devto-workflow", label: "Compare with a Dev.to-only workflow", description: "See where source-of-truth publishing changes the process." },
      { href: "/pricing", label: "Pricing", description: "Review the current plan and machine-readable pricing file." },
    ],
  },
  {
    slug: "seo-metadata",
    eyebrow: "Feature",
    title: "SEO Metadata",
    description: "Generate, edit, and own page metadata directly in the paper workflow without relying on a separate SEO plugin.",
    body: `
Every public page needs a title, description, canonical URL, image data, and structured context that matches the visible content. Whitepapper keeps that metadata close to the paper so it does not get lost in a second system.

## What the metadata workflow covers

- page title and meta description
- canonical URL
- Open Graph and Twitter image fields
- article dates, word count, reading time, and author fields
- structured data consumed by the public page layouts

## Why this matters

When metadata lives next to the paper, it is easier to review before publishing and easier to keep aligned with the page after updates. That helps search engines, AI systems, and social previews all work from the same facts.

## Manual generation by design

Whitepapper now treats metadata generation as an explicit action in the editor. The generated result stays in the client-side paper state until you choose to save it. That keeps the workflow predictable and makes review easier.

## Next steps

Read [Metadata Workflow](/docs/editor/metadata-workflow), then go deeper with [Paper Metadata](/docs/seo/paper-metadata) and [canonical URL guidance](/glossary/canonical-url).
`,
    faq: [
      {
        question: "Does Whitepapper still auto-generate metadata on save?",
        answer: "No. Metadata generation is an explicit editor action, and you manually save the generated result when you are happy with it.",
      },
      {
        question: "Can I edit generated metadata?",
        answer: "Yes. The generated fields are editable before you save them back into the paper document.",
      },
      {
        question: "Why keep metadata generation manual?",
        answer: "Manual generation keeps the workflow predictable so you can review titles, descriptions, and canonicals before they go live.",
      },
    ],
    links: [
      { href: "/docs/editor/metadata-workflow", label: "Metadata workflow docs", description: "See how generation and manual save work together." },
      { href: "/docs/seo/paper-metadata", label: "Paper metadata fields", description: "Understand how every field maps to public output." },
      { href: "/glossary/canonical-url", label: "Glossary: Canonical URL", description: "A quick refresher on canonical ownership." },
    ],
  },
  {
    slug: "public-pages",
    eyebrow: "Feature",
    title: "Public Pages",
    description: "Serve crawlable public profile, project, and paper pages with canonical, metadata, and schema baked into the output.",
    body: `
Whitepapper does not stop at the editor. It also ships the public profile, project, and paper pages that search engines and AI systems actually read.

## Public page types

- profile pages for public identities
- project pages for grouped work
- paper pages for the individual documents
- blog aliases when you want editorial organization without changing the original paper URL

## Why they matter

If the public output is weak, good content still underperforms. Whitepapper focuses on crawlable HTML, canonical clarity, metadata, schema, and structured internal linking so the public layer is useful by default.

## Quality guardrails

Public pages are where heading hierarchy, image alt text, breadcrumbs, and indexability rules matter most. They are also what external distribution workflows and AI retrieval systems tend to cite.

## Next steps

Read [Public Pages](/docs/seo/public-pages), then explore [developer blog](/use-cases/developer-blog) and [docs and updates](/use-cases/docs-and-updates) to see how the public layer fits real publishing workflows.
`,
    faq: [
      {
        question: "Are public pages separate from the API?",
        answer: "They are related but separate outputs. The API exposes the content data, while the public pages expose the same content through crawlable HTML.",
      },
      {
        question: "Can I keep both a blog URL and the original paper URL?",
        answer: "Yes. Whitepapper can support both, while keeping one preferred original URL for canonical and metadata ownership.",
      },
      {
        question: "Do public pages work for both users and search crawlers?",
        answer: "Yes. The pages are built to be crawlable and structured for both human reading and machine interpretation.",
      },
    ],
    links: [
      { href: "/docs/seo/public-pages", label: "Public pages docs", description: "See how public profile, project, and paper pages behave." },
      { href: "/use-cases/developer-blog", label: "Developer blog use case", description: "Use public pages as the primary blog layer." },
      { href: "/compare/whitepapper-vs-ghost", label: "Compare with Ghost", description: "See how Whitepapper approaches public publishing differently." },
    ],
  },
];

export const useCasePages: DetailPage[] = [
  {
    slug: "developer-blog",
    eyebrow: "Use Case",
    title: "Developer Blog",
    description: "Run a developer blog from markdown-first content, clean canonicals, and a public page layer that search engines can crawl.",
    body: `
If your blog is part portfolio, part docs, part release log, Whitepapper fits that hybrid model better than a blog-only tool.

## The old workflow

You draft in one place, clean up metadata somewhere else, then republish or duplicate the post again on external platforms. The result is usually inconsistent titles, weaker canonicals, and too much time spent on operations instead of writing.

## The Whitepapper workflow

You keep the paper as the source of truth, generate metadata deliberately, publish the original URL, and then use the same content for distribution and API-backed frontends.

## Why it works for developer writing

Developer blogs often blend tutorials, changelogs, notes, SEO experiments, and public docs. Whitepapper keeps those content types close together while still giving them different public surfaces.

## Recommended setup

Start with the [SEO metadata feature](/features/seo-metadata), connect the [Content API](/features/content-api), and keep [pricing](/pricing) and docs links available from the blog so the content can convert as well as rank.
`,
    faq: [
      {
        question: "Does Whitepapper only work for marketing blogs?",
        answer: "No. It is especially useful when your blog, docs, updates, and public project writing overlap.",
      },
      {
        question: "Can I mix tutorials, changelogs, and docs posts in one setup?",
        answer: "Yes. That hybrid content model is one of the strongest fits for Whitepapper.",
      },
      {
        question: "Will this workflow still support distribution channels?",
        answer: "Yes. You can keep the original post in Whitepapper and distribute outward when you need reach.",
      },
    ],
    links: [
      { href: "/features/seo-metadata", label: "SEO metadata", description: "Keep the blog metadata workflow inside the editor." },
      { href: "/features/public-pages", label: "Public pages", description: "Understand the public page layer the blog sits on." },
      { href: "/compare/whitepapper-vs-ghost", label: "Whitepapper vs Ghost", description: "Compare the two approaches for developer publishing." },
    ],
  },
  {
    slug: "portfolio-content-api",
    eyebrow: "Use Case",
    title: "Portfolio Content API",
    description: "Use Whitepapper as the content backend for a portfolio or personal site while keeping one writing workflow.",
    body: `
Many developer portfolios end up maintaining separate systems for projects, blog posts, and writing samples. Whitepapper gives you a single content source and a read API that can power the portfolio frontend directly.

## Good fit for this use case

- personal websites that mix projects and writing
- portfolio frontends built with Astro, Next.js, or another custom stack
- builders who want public project pages and reusable content data

## Why the model works

Projects, collections, and papers map cleanly to the way most developer portfolios are already structured. You can publish public project pages on Whitepapper while still using the API to build a custom frontend around the same source content.

## What to connect

Use the [Content API](/features/content-api), keep public profile and project pages enabled through [Public Pages](/features/public-pages), and link deeper technical explanations from the [Dev API docs](/docs/dev-api/overview).
`,
    faq: [
      {
        question: "Can I keep my own frontend and still use Whitepapper?",
        answer: "Yes. That is one of the main reasons to use the Content API in the first place.",
      },
      {
        question: "Can I model both projects and writing samples together?",
        answer: "Yes. Projects, collections, and papers are designed to support that combined portfolio model.",
      },
      {
        question: "Is this only for big teams?",
        answer: "No. The current free plan is intentionally practical for solo developers and indie builders.",
      },
    ],
    links: [
      { href: "/features/content-api", label: "Content API", description: "The core feature for this workflow." },
      { href: "/features/public-pages", label: "Public pages", description: "Pair the API with a default public layer." },
      { href: "/docs/dev-api/contracts", label: "Dev API contracts", description: "See the request and response shape." },
    ],
  },
  {
    slug: "docs-and-updates",
    eyebrow: "Use Case",
    title: "Docs and Updates",
    description: "Publish docs, changelog-style updates, and evergreen technical resources from one content system.",
    body: `
Whitepapper works well when docs and updates should live close to the same product truth. Instead of maintaining separate tools for docs, release notes, and public resources, you can keep them in one workflow and organize them by URL, collection, and metadata.

## Where it helps

- product updates that need public release pages
- evergreen resource articles that should link back into docs
- docs pages that need stronger product context and internal linking

## Operational advantage

When docs and updates stay connected, it becomes easier to add related links, keep terminology consistent, and make public release notes easier for both users and search systems to understand.

## Suggested path

Use [Distribution](/features/distribution) for outward publishing, [Public Pages](/features/public-pages) for crawlable output, and the [SEO overview](/docs/seo/overview) to keep the public layer aligned.
`,
    faq: [
      {
        question: "Should docs and updates live together?",
        answer: "They can, as long as the public URLs and section structure make the distinction clear. Whitepapper supports that hybrid setup well.",
      },
      {
        question: "Can release notes link directly into docs pages?",
        answer: "Yes. Related linking between updates and docs is a core advantage of this setup.",
      },
      {
        question: "Does this help SEO consistency?",
        answer: "Yes. Keeping docs and updates close improves metadata consistency, linking discipline, and canonical clarity.",
      },
    ],
    links: [
      { href: "/features/distribution", label: "Distribution", description: "Push updates outward from the same content source." },
      { href: "/docs/seo/overview", label: "SEO overview", description: "Keep docs and resources aligned with crawl rules." },
      { href: "/pricing", label: "Pricing", description: "Link docs and updates back to a clear product page." },
    ],
  },
];

export const comparePages: DetailPage[] = [
  {
    slug: "whitepapper-vs-ghost",
    eyebrow: "Compare",
    title: "Whitepapper vs Ghost",
    description: "Compare Whitepapper and Ghost for markdown-first developer publishing, public pages, distribution, and API-backed content workflows.",
    body: `
Whitepapper and Ghost both help you publish on the web, but they optimize for different workflows.

## Quick comparison

| Topic | Whitepapper | Ghost |
| --- | --- | --- |
| Core model | Markdown-first content platform for developers | Full publishing platform with memberships and editorial tooling |
| Public page layer | Profiles, projects, papers, docs, and blog aliases | Theme-driven publication site |
| API-backed reuse | Central to the product | Available, but not the main story for this use case |
| Distribution workflow | Built around write once, distribute outward | Typically publish on Ghost first and manage distribution separately |
| Best fit | Developer blog, docs, portfolio, API-first content reuse | Publication sites, newsletters, and editorial publishing |

## Choose Whitepapper if

- you want one source of truth for docs, projects, blog content, and public papers
- your own frontend matters as much as the default public site
- canonical control and API-backed reuse are part of the publishing workflow

## Choose Ghost if

- you want a polished publication product with built-in memberships and newsroom-style workflows
- you need more editorial-site features than developer-content operations features

## Bottom line

Ghost is stronger as a publication platform. Whitepapper is stronger when the content also needs to behave like structured developer data.
`,
    faq: [
      {
        question: "Is Whitepapper trying to be a Ghost clone?",
        answer: "No. Whitepapper is aimed at markdown-first developer publishing with API reuse, public project pages, and outward distribution rather than full publication management.",
      },
      {
        question: "Which one is better for memberships and newsletters?",
        answer: "Ghost is generally stronger for built-in membership and publication workflows.",
      },
      {
        question: "Which one is better for API-first developer content?",
        answer: "Whitepapper is stronger when your content needs structured reuse across custom frontends and public pages.",
      },
    ],
    links: [
      { href: "/features/content-api", label: "Content API", description: "One of the clearest product differences." },
      { href: "/use-cases/developer-blog", label: "Developer blog use case", description: "See Whitepapper in the workflow it fits best." },
      { href: "/pricing", label: "Pricing", description: "Check the current plan before comparing adoption cost." },
    ],
  },
  {
    slug: "whitepapper-vs-hashnode",
    eyebrow: "Compare",
    title: "Whitepapper vs Hashnode",
    description: "Compare Whitepapper and Hashnode for original content ownership, multi-surface publishing, and developer-first content workflows.",
    body: `
Hashnode is a publishing destination. Whitepapper is a content source and public layer you can publish from.

## Quick comparison

| Topic | Whitepapper | Hashnode |
| --- | --- | --- |
| Primary role | Source-of-truth content platform | Public publishing platform |
| Distribution | Publishes outward to supported platforms | Primarily publishes within Hashnode |
| Public content reuse | Built around APIs and reusable structure | More focused on the hosted publication |
| Canonical ownership | Kept close to the original paper | Depends on how you publish and configure it |

## Choose Whitepapper if

- your content needs to power multiple surfaces
- you want project pages, docs, resources, and public papers under one model
- you want Hashnode to be a channel, not the source of truth

## Choose Hashnode if

- you want a strong hosted writing destination with a developer audience built in
- you do not need Whitepapper's API-first model or public project structure
`,
    faq: [
      {
        question: "Can I use both together?",
        answer: "Yes. That is one of the practical Whitepapper workflows: keep the original content in Whitepapper, then distribute to Hashnode when you want reach there too.",
      },
      {
        question: "Who should choose Hashnode as the primary destination?",
        answer: "Teams that mainly want a hosted developer publication with built-in audience benefits may prefer Hashnode-first publishing.",
      },
      {
        question: "Why would I still keep Whitepapper as source of truth?",
        answer: "It gives you stronger canonical ownership, reusable APIs, and more control over multi-surface publishing.",
      },
    ],
    links: [
      { href: "/features/distribution", label: "Distribution", description: "See how Hashnode fits the outward publishing flow." },
      { href: "/docs/distribution/hashnode", label: "Hashnode docs", description: "Review the current setup process." },
      { href: "/glossary/canonical-url", label: "Glossary: Canonical URL", description: "Canonical ownership matters most in this comparison." },
    ],
  },
  {
    slug: "whitepapper-vs-devto-workflow",
    eyebrow: "Compare",
    title: "Whitepapper vs a Dev.to-Only Workflow",
    description: "Compare Whitepapper with publishing directly on Dev.to when you care about owning the original page, metadata, and reusable content structure.",
    body: `
Publishing only on Dev.to is fast, but it makes Dev.to the primary surface for the workflow. Whitepapper changes that by turning Dev.to into one of the channels instead of the source of truth.

## Quick comparison

| Topic | Whitepapper | Dev.to only |
| --- | --- | --- |
| Original content home | Whitepapper | Dev.to |
| Structured metadata workflow | Yes | Limited to what Dev.to exposes |
| Public page variants | Profiles, projects, papers, docs | Article pages and profile pages on Dev.to |
| Reusable content API | Yes | No equivalent project-level content API |

## Choose Whitepapper if

- you want to own the original page URL
- your writing also needs to support a portfolio, docs site, or product site
- you want the same paper to feed multiple destinations

## Choose Dev.to only if

- speed matters more than source-of-truth control
- you are happy treating Dev.to as the main public destination
`,
    faq: [
      {
        question: "Why not just post directly on Dev.to?",
        answer: "Direct posting is fine if Dev.to is the destination you care about most. Whitepapper is for cases where your own site and your structured content model matter more.",
      },
      {
        question: "Can Dev.to still be part of the workflow?",
        answer: "Yes. Whitepapper can treat Dev.to as a distribution channel rather than the original home of the content.",
      },
      {
        question: "What is the main trade-off in a Dev.to-only workflow?",
        answer: "You gain speed, but you usually give up source-of-truth control for metadata, canonical ownership, and content reuse.",
      },
    ],
    links: [
      { href: "/features/distribution", label: "Distribution", description: "See how Dev.to fits into the outward workflow." },
      { href: "/features/seo-metadata", label: "SEO metadata", description: "Keep metadata ownership close to the original paper." },
      { href: "/pricing", label: "Pricing", description: "Review adoption cost before changing workflows." },
    ],
  },
];

export const glossaryPages: DetailPage[] = [
  {
    slug: "llms-txt",
    eyebrow: "Glossary",
    title: "llms.txt",
    description: "A plain-text file that helps AI systems understand what your site is, who it is for, and which pages matter most.",
    body: `
\`llms.txt\` is a machine-readable file placed at the root of a site. It gives AI systems a concise summary of the product, the most important pages, and the paths they should prefer when they need context quickly.

## Why it matters

AI assistants often do not have the patience or reliability to infer the whole structure of a site from scattered pages. A good \`llms.txt\` gives them the essentials directly.

## What a strong file usually includes

- product definition
- who the product is for
- the main canonical pages
- links to docs, pricing, and important reference pages
- a pointer to a richer file like \`llms-full.txt\` when needed

## Whitepapper context

Whitepapper publishes both \`/llms.txt\` and \`/llms-full.txt\` so AI systems can quickly discover the product definition and then move to deeper references.
`,
    links: [
      { href: "/llms.txt", label: "Read llms.txt", description: "The short machine-readable summary." },
      { href: "/llms-full.txt", label: "Read llms-full.txt", description: "The longer AI context file." },
      { href: "/docs/seo/overview", label: "SEO overview", description: "See where llms.txt fits the broader public output." },
    ],
  },
  {
    slug: "canonical-url",
    eyebrow: "Glossary",
    title: "Canonical URL",
    description: "The preferred original URL for a page when the same content can be reached through more than one path.",
    body: `
A canonical URL tells search systems which page version should be treated as the original when duplicates or near-duplicates exist.

## Why it matters

Without a clear canonical, search engines can split signals across multiple URLs or pick the wrong page as the preferred version.

## Common dynamic-site examples

- multiple routes showing the same paper
- the same content under a profile URL and a blog alias
- tracking parameters that do not change the core content

## Whitepapper context

Whitepapper keeps canonical metadata close to the paper so the preferred original URL can stay aligned across the public page, metadata, schema, sitemaps, and distribution flows.
`,
    links: [
      { href: "/features/seo-metadata", label: "SEO metadata", description: "See where canonical selection lives in Whitepapper." },
      { href: "/docs/seo/public-pages", label: "Public pages docs", description: "See how canonical behavior shows up publicly." },
      { href: "/compare/whitepapper-vs-hashnode", label: "Whitepapper vs Hashnode", description: "Canonical ownership is a practical difference here." },
    ],
  },
  {
    slug: "programmatic-seo",
    eyebrow: "Glossary",
    title: "Programmatic SEO",
    description: "A way of creating search-targeted pages at scale using structured data, templates, and consistent internal linking.",
    body: `
Programmatic SEO is the practice of creating many search-targeted pages from structured data and repeatable templates.

## Good programmatic SEO pages need more than templates

- clear page intent
- useful original information
- clean internal linking
- strong canonical rules
- indexable public output

## Why Whitepapper is relevant

Whitepapper is useful when the same structured content needs to feed many public pages or frontends without turning into a messy CMS workflow.
`,
    links: [
      { href: "/features/content-api", label: "Content API", description: "The structured-data side of the story." },
      { href: "/features/public-pages", label: "Public pages", description: "The crawlable-output side of the story." },
      { href: "/docs/seo/sitemaps", label: "Sitemaps docs", description: "Indexing discipline matters for scaled page sets." },
    ],
  },
  {
    slug: "content-api",
    eyebrow: "Glossary",
    title: "Content API",
    description: "An API that returns structured content objects so a frontend can render the same writing across different surfaces.",
    body: `
A content API exposes structured content through endpoints instead of locking it inside a single hosted frontend.

## Why developers like it

- one source of truth
- reusable content across sites and apps
- cleaner separation between content and presentation

## Whitepapper context

Whitepapper treats projects, collections, and papers as structured content objects, then exposes them both through public pages and through the read API.
`,
    links: [
      { href: "/features/content-api", label: "Content API feature", description: "The product page for this concept." },
      { href: "/use-cases/portfolio-content-api", label: "Portfolio use case", description: "A practical way to use the API." },
      { href: "/docs/dev-api/overview", label: "Dev API overview", description: "The documentation entry point." },
    ],
  },
];

export const pricingPage = {
  eyebrow: "Pricing",
  title: "Whitepapper Pricing",
  description: "Whitepapper is currently free while the core markdown, public pages, API, and distribution workflows continue to mature.",
  body: `
Whitepapper is currently free to use.

## Current plan

| Plan | Price | Best for | Includes |
| --- | --- | --- | --- |
| Free | $0/month | Solo developers, indie builders, technical writers | Markdown editor, public pages, Dev API, metadata workflow, distribution support, docs |

## What this means today

The current goal is to make the core product trustworthy before introducing more pricing complexity. If you want to adopt Whitepapper now, you can use the current feature set without a paid tier.

## Why publish a pricing page anyway

Pricing clarity helps both people and AI systems understand how a product is positioned. It also prevents "contact sales" ambiguity from becoming a blocker in AI-mediated product comparisons.

## Machine-readable pricing

Whitepapper also publishes a machine-readable [pricing.md](/pricing.md) file so AI systems can parse the current pricing state without rendering the page.
`,
  faq: [
    {
      question: "Is Whitepapper paid right now?",
      answer: "No. Whitepapper is currently free to use.",
    },
    {
      question: "Will there be more plans later?",
      answer: "Likely yes, but the current public pricing state is a single free plan while the product continues to mature.",
    },
    {
      question: "What is included in the free tier?",
      answer: "The free tier includes markdown writing, public pages, the Dev API allowance, metadata workflow, and current distribution support.",
    },
  ],
  links: [
    { href: "/pricing.md", label: "pricing.md", description: "Machine-readable pricing for AI agents and parsers." },
    { href: "/features/content-api", label: "Content API", description: "One of the main included capabilities." },
    { href: "/features/distribution", label: "Distribution", description: "See the publish-once workflow supported today." },
  ],
};

export const sectionIndexPages = {
  features: {
    eyebrow: "Features",
    title: "Whitepapper Features",
    description: "Explore the core features behind Whitepapper's markdown-first, API-backed publishing workflow.",
    links: featurePages.map((page) => ({
      href: `/features/${page.slug}`,
      label: page.title,
      description: page.description,
    })),
  },
  useCases: {
    eyebrow: "Use Cases",
    title: "Whitepapper Use Cases",
    description: "See how Whitepapper fits developer blogs, portfolio frontends, docs, and public update workflows.",
    links: useCasePages.map((page) => ({
      href: `/use-cases/${page.slug}`,
      label: page.title,
      description: page.description,
    })),
  },
  compare: {
    eyebrow: "Compare",
    title: "Compare Whitepapper",
    description: "Compare Whitepapper with common developer publishing workflows and adjacent tools.",
    links: comparePages.map((page) => ({
      href: `/compare/${page.slug}`,
      label: page.title,
      description: page.description,
    })),
  },
  glossary: {
    eyebrow: "Glossary",
    title: "Whitepapper Glossary",
    description: "Definitions for the SEO, GEO, canonical, and content-API concepts that shape Whitepapper's public publishing model.",
    links: glossaryPages.map((page) => ({
      href: `/glossary/${page.slug}`,
      label: page.title,
      description: page.description,
    })),
  },
};

export function getFeaturePage(slug: string): DetailPage | undefined {
  return featurePages.find((page) => page.slug === slug);
}

export function getUseCasePage(slug: string): DetailPage | undefined {
  return useCasePages.find((page) => page.slug === slug);
}

export function getComparePage(slug: string): DetailPage | undefined {
  return comparePages.find((page) => page.slug === slug);
}

export function getGlossaryPage(slug: string): DetailPage | undefined {
  return glossaryPages.find((page) => page.slug === slug);
}
