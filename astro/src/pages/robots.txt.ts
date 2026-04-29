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
  "/mcp/connect",
  "/mcp/connect/",
  "/welcome",
  "/welcome/",
];

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");

  const disallowLines = PRIVATE_PATHS.map((path) => `Disallow: ${path}`).join("\n");

  const body = `User-agent: *
Allow: /
${disallowLines}

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
};
