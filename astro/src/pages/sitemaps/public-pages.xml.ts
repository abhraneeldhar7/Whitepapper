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
  "/llms.txt",
  "/llms-full.txt",
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");
  const urlEntries = PUBLIC_STATIC_PATHS.map((path) => {
    const absolute = `${baseUrl}${path === "/" ? "" : path}`;
    return `<url><loc>${escapeXml(absolute)}</loc></url>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800",
    },
  });
};
