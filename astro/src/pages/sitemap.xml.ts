import type { APIRoute } from "astro";

const PUBLIC_STATIC_PATHS = [
  "/",
  "/about",
  "/blogs",
  "/contact",
  "/docs",
  "/integrations",
  "/privacy-policy",
  "/resources",
  "/terms-of-service",
  "/updates",
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");

  const staticEntries = PUBLIC_STATIC_PATHS.map((path) => {
    const loc = `${baseUrl}${path === "/" ? "" : path}`;
    return `<url><loc>${escapeXml(loc)}</loc></url>`;
  }).join("\n");

  const dynamicSitemaps = [
    `${baseUrl}/sitemaps/public-papers.xml`,
  ];

  const dynamicEntries = dynamicSitemaps
    .map((loc) => `<url><loc>${escapeXml(loc)}</loc></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticEntries}
${dynamicEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800",
    },
  });
};
