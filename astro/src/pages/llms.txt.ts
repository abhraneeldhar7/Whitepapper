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
    `Sitemap: ${baseUrl}/sitemap.xml`,
    `Sitemap: ${baseUrl}/sitemap-index.xml`,
    `Sitemap: ${baseUrl}/sitemaps/public-pages.xml`,
    `Sitemap: ${baseUrl}/sitemaps/docs-pages.xml`,
    `Sitemap: ${baseUrl}/sitemaps/public-projects.xml`,
    `Sitemap: ${baseUrl}/sitemaps/public-papers.xml`,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
};
