import type { APIRoute } from "astro";

const RESTRICTED_PATHS = [
  "/dashboard",
  "/settings",
  "/write",
  "/login",
  "/sign-in",
  "/sign-up",
  "/sso-callback",
  "/unauthorized",
  "/mcp/connect",
];

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");

  const body = [
    "# Whitepapper LLM access policy",
    "",
    "User-agent: *",
    "Allow: /",
    ...RESTRICTED_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Reference: ${baseUrl}/llms-full.txt`,
    "",
    `Product: Markdown-first content platform for developers`,
    `For: Solo developers, indie builders, technical writers, and small technical teams`,
    "",
    `Primary pages: ${baseUrl}/pricing, ${baseUrl}/features, ${baseUrl}/use-cases, ${baseUrl}/docs, ${baseUrl}/blogs`,
    `Key references: ${baseUrl}/features/content-api, ${baseUrl}/features/distribution, ${baseUrl}/features/seo-metadata, ${baseUrl}/glossary/llms-txt`,
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
};
