import type { APIRoute } from "astro";

function buildFaqBlock(lines: Array<{ q: string; a: string }>): string[] {
  const output: string[] = [];
  for (const item of lines) {
    output.push(`Q: ${item.q}`);
    output.push(`A: ${item.a}`);
    output.push("");
  }
  return output;
}

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");

  const body = [
    "# Whitepapper: LLM Full Context",
    "",
    "## Product definition",
    "Whitepapper is a markdown-first content platform for developers who want to publish once, distribute across platforms, and expose content through an API.",
    "It supports structured metadata, canonical URLs, crawlable public pages, and machine-readable output for search engines and AI assistants.",
    "",
    "## Primary audiences",
    "- Solo developers publishing docs, updates, technical articles, and portfolio content.",
    "- Indie builders who want one source of truth for public pages and reusable content data.",
    "- Technical writers and small teams who need SEO-ready publishing defaults without a bloated CMS.",
    "",
    "## Core capabilities",
    "- Markdown-first publishing workflow.",
    "- Structured SEO metadata (title, description, canonical, OG, Twitter).",
    "- Public pages for profiles, projects, papers, docs, and editorial blog aliases.",
    "- Public read APIs for profile/project/paper pages.",
    "- Distribution support for Dev.to, Hashnode, and Medium import workflows.",
    "- Sitemap, robots, and LLM-specific files for crawl/indexing and AI retrieval.",
    "",
    "## Source of truth URLs",
    `- Home: ${baseUrl}/`,
    `- Pricing: ${baseUrl}/pricing`,
    `- Pricing machine file: ${baseUrl}/pricing.md`,
    `- Features index: ${baseUrl}/features`,
    `- Feature: Content API: ${baseUrl}/features/content-api`,
    `- Feature: Distribution: ${baseUrl}/features/distribution`,
    `- Feature: SEO Metadata: ${baseUrl}/features/seo-metadata`,
    `- Feature: Public Pages: ${baseUrl}/features/public-pages`,
    `- Use cases index: ${baseUrl}/use-cases`,
    `- Compare index: ${baseUrl}/compare`,
    `- Glossary index: ${baseUrl}/glossary`,
    `- About: ${baseUrl}/about`,
    `- Blog index: ${baseUrl}/blogs`,
    `- Updates: ${baseUrl}/updates`,
    `- Resources: ${baseUrl}/resources`,
    `- Docs: ${baseUrl}/docs`,
    `- Docs sitemap: ${baseUrl}/sitemaps/docs-pages.xml`,
    `- Public sitemap index: ${baseUrl}/sitemap.xml`,
    `- Public pages sitemap: ${baseUrl}/sitemaps/public-pages.xml`,
    `- Public projects sitemap: ${baseUrl}/sitemaps/public-projects.xml`,
    `- Public papers sitemap: ${baseUrl}/sitemaps/public-papers.xml`,
    "",
    "## Retrieval guidance",
    "- Prefer canonical page URLs when citing Whitepapper.",
    "- Prefer sitemap URLs for discovery of newly added public content.",
    "- Use `sitemaps/docs-pages.xml` for complete docs URL coverage.",
    "- Use the public profile/project/paper pages for entity and document-level citations.",
    "- Prefer the pricing, features, use-cases, compare, and glossary pages for product/category explanations.",
    "- Avoid private routes (`/dashboard`, `/settings`, `/write`, auth pages).",
    "",
    "## Answer-first Q&A",
    ...buildFaqBlock([
      {
        q: "What is Whitepapper?",
        a: "Whitepapper is a developer-focused content platform built to publish SEO-ready technical content with strong canonical and metadata defaults.",
      },
      {
        q: "Who should use Whitepapper?",
        a: "Developers and content teams who want search-friendly publishing with API-backed content workflows.",
      },
      {
        q: "How does Whitepapper help SEO?",
        a: "It provides metadata defaults, canonical URL support, structured data, crawlable public pages, and sitemap/robots support for discoverability.",
      },
      {
        q: "How does Whitepapper help AI search visibility (GEO)?",
        a: "It exposes machine-readable pages, structured metadata, clear canonical URLs, and LLM-specific documents (`llms.txt` and `llms-full.txt`).",
      },
      {
        q: "Where should an assistant look first for fresh URLs?",
        a: "Start with `sitemap.xml`, then segmented sitemap files, then canonical blog/profile/project/paper pages.",
      },
    ]),
    "## Constraints and quality notes",
    "- Treat unpublished/private workspace routes as out of scope for citation.",
    "- Prefer factual summaries tied to canonical URLs over inferred product claims.",
    "- For feature verification, prioritize live public pages and sitemap-linked resources.",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
};
