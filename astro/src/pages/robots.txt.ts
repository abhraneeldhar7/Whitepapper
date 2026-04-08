import type { APIRoute } from "astro";

const PRIVATE_PATHS = [
  "/dashboard",
  "/dashboard/",
  "/settings",
  "/settings/",
  "/write",
  "/write/",
  "/login",
  "/login/",
  "/sign-in",
  "/sign-in/",
  "/sign-up",
  "/sign-up/",
  "/sso-callback",
  "/sso-callback/",
  "/unauthorized",
  "/unauthorized/",
];

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");

  const disallowLines = PRIVATE_PATHS.map((path) => `Disallow: ${path}`).join("\n");

  const body = `User-agent: *
Allow: /
${disallowLines}

User-agent: GPTBot
Allow: /
${disallowLines}

User-agent: ClaudeBot
Allow: /
${disallowLines}

User-agent: PerplexityBot
Allow: /
${disallowLines}

User-agent: Google-Extended
Allow: /
${disallowLines}

Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/sitemap-index.xml
Sitemap: ${baseUrl}/sitemaps/public-pages.xml
Sitemap: ${baseUrl}/sitemaps/docs-pages.xml
Sitemap: ${baseUrl}/sitemaps/public-projects.xml
Sitemap: ${baseUrl}/sitemaps/public-papers.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
};
