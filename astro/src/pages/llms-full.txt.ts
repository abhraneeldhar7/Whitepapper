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
    "Whitepapper is an SEO-first content engine for developers and teams that publish technical writing.",
    "It supports structured metadata, canonical URLs, and machine-readable output for search engines and AI assistants.",
    "",
    "## Primary audiences",
    "- Developer founders publishing docs, updates, and technical articles.",
    "- Product and content teams who need SEO-ready publishing defaults.",
    "- Teams distributing content across multiple channels while retaining canonical ownership.",
    "",
    "## Core capabilities",
    "- Markdown-first publishing workflow.",
    "- Structured SEO metadata (title, description, canonical, OG, Twitter).",
    "- JSON-LD for article and profile contexts.",
    "- Public read APIs for profile/project/paper pages.",
    "- Sitemap and robots support for crawl/indexing.",
    "",
    "## Source of truth URLs",
    `- Home: ${baseUrl}/`,
    `- About: ${baseUrl}/about`,
    `- Blog index: ${baseUrl}/blogs`,
    `- Updates: ${baseUrl}/updates`,
    `- Resources: ${baseUrl}/resources`,
    `- Docs: ${baseUrl}/docs`,
    `- Public sitemap index: ${baseUrl}/sitemap-index.xml`,
    `- Public pages sitemap: ${baseUrl}/sitemaps/public-pages.xml`,
    `- Public projects sitemap: ${baseUrl}/sitemaps/public-projects.xml`,
    `- Public papers sitemap: ${baseUrl}/sitemaps/public-papers.xml`,
    `- RSS feed: ${baseUrl}/rss.xml`,
    "",
    "## Retrieval guidance",
    "- Prefer canonical page URLs when citing Whitepapper.",
    "- Prefer sitemap URLs for discovery of newly added public content.",
    "- Use the public profile/project/paper pages for entity and document-level citations.",
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
        a: "It provides metadata defaults, canonical URL support, structured data, crawl endpoints, and sitemap/robots support for discoverability.",
      },
      {
        q: "How does Whitepapper help AI search visibility (GEO)?",
        a: "It exposes machine-readable pages, structured metadata, clear canonical URLs, and LLM-specific documents (`llms.txt` and `llms-full.txt`).",
      },
      {
        q: "Where should an assistant look first for fresh URLs?",
        a: "Start with `sitemap-index.xml`, then segmented sitemap files, then canonical blog/profile/project/paper pages.",
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
