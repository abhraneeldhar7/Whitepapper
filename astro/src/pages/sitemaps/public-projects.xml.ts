import type { APIRoute } from "astro";

type SeoItem = {
  url: string;
  lastModified?: string | null;
};

type SeoProfilesProjectsPayload = {
  profiles?: SeoItem[];
  projects?: SeoItem[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function resolveAbsoluteUrl(targetUrl: string, siteUrl: string): string {
  const trimmed = (targetUrl || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `${siteUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

function createUrlEntry(item: SeoItem, siteUrl: string): string {
  const loc = resolveAbsoluteUrl(item.url, siteUrl);
  if (!loc) return "";
  const lastModValue = (item.lastModified || "").trim();
  const lastmod = lastModValue
    ? `<lastmod>${escapeXml(new Date(lastModValue).toISOString())}</lastmod>`
    : "";
  return `<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`;
}

export const GET: APIRoute = async () => {
  const apiBaseUrl = String(import.meta.env.PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const siteUrl = String(import.meta.env.PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

  if (!apiBaseUrl || !siteUrl) {
    return new Response("PUBLIC_API_BASE_URL or PUBLIC_SITE_URL is missing.", { status: 500 });
  }

  const response = await fetch(`${apiBaseUrl}/public/seo/profiles-projects`, { method: "GET" });
  if (!response.ok) {
    return new Response("Unable to generate public projects sitemap.", { status: 502 });
  }

  const payload = (await response.json()) as SeoProfilesProjectsPayload;
  const profiles = Array.isArray(payload?.profiles) ? payload.profiles : [];
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const urlEntries = [...profiles, ...projects]
    .map((item) => createUrlEntry(item, siteUrl))
    .filter(Boolean)
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=300",
    },
  });
};
