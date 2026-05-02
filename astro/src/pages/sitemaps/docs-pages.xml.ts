import type { APIRoute } from "astro";
import { docsPageEntries } from "@/content/docs/docsPagesStructure";

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
  const docsLastUpdated = "2026-04-12T00:00:00.000Z";
  const docsEntries = [
    {
      path: "/docs",
      updatedAt: docsLastUpdated,
    },
    ...docsPageEntries.map((entry) => ({
      path: entry.route,
      updatedAt: docsLastUpdated,
    })),
  ];

  const xmlEntries = docsEntries
    .map((entry) => {
      const path = entry.path;
      const loc = `${baseUrl}${path === "/" ? "" : path}`;
      return `<url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(entry.updatedAt)}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=300",
    },
  });
};
