import type { APIRoute } from "astro";

type SeoPaperItem = {
  url: string;
  lastModified?: string | null;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveAbsoluteUrl(url: string, siteUrl: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (!siteUrl) return trimmed;
  return `${siteUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export const GET: APIRoute = async () => {
  const apiBaseUrl = String(import.meta.env.PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const siteUrl = String(import.meta.env.PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

  if (!apiBaseUrl || !siteUrl) {
    return new Response("PUBLIC_API_BASE_URL or PUBLIC_SITE_URL is missing.", { status: 500 });
  }

  const response = await fetch(`${apiBaseUrl}/public/seo/papers`, { method: "GET" });
  if (!response.ok) {
    return new Response("Unable to generate public papers sitemap.", { status: 502 });
  }

  const payload = (await response.json()) as { papers?: SeoPaperItem[] };
  const papers = Array.isArray(payload?.papers) ? payload.papers : [];
  const seen = new Set<string>();

  const entries = await Promise.all(
    papers.map(async (item) => {
      const loc = resolveAbsoluteUrl(item.url, siteUrl);
      if (!loc || seen.has(loc)) return "";
      seen.add(loc);

      try {
        const validationResponse = await fetch(loc, { method: "GET" });
        if (!validationResponse.ok) {
          return "";
        }
      } catch {
        return "";
      }

      const lastModValue = (item.lastModified || "").trim();
      const lastmod = lastModValue
        ? `<lastmod>${escapeXml(new Date(lastModValue).toISOString())}</lastmod>`
        : "";
      return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
    }),
  );

  const urlEntries = entries.filter(Boolean).join("");

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
