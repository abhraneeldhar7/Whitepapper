import type { APIRoute } from "astro";
import { resolvePreferredPaperPath } from "@/lib/seo";

type BlogPaper = {
  title?: string;
  slug?: string;
  metadata?: {
    canonical?: string;
    metaDescription?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

type BlogCollectionPayload = {
  papers?: BlogPaper[];
};

const MARKETING_COLLECTIONS = ["updates", "resources"];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toAbsoluteUrl(value: string, baseUrl: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `${baseUrl}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

export const GET: APIRoute = async ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");
  const apiBaseUrl = String(import.meta.env.PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = String(import.meta.env.WHITEPAPPER_API_KEY ?? "").trim();

  if (!apiBaseUrl || !apiKey) {
    return new Response("PUBLIC_API_BASE_URL or WHITEPAPPER_API_KEY is missing.", { status: 500 });
  }

  const fetched = await Promise.all(
    MARKETING_COLLECTIONS.map(async (slug) => {
      const endpoint = `${apiBaseUrl}/dev/collection?slug=${encodeURIComponent(slug)}`;
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-api-key": apiKey,
        },
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as BlogCollectionPayload;
      return Array.isArray(payload?.papers) ? payload.papers : [];
    }),
  );

  const seen = new Set<string>();
  const items = fetched.flat().filter((paper) => {
    const slug = (paper.slug || "").trim().toLowerCase();
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });

  const channelItems = items
    .sort((a, b) => +new Date(b.updatedAt || b.createdAt || 0) - +new Date(a.updatedAt || a.createdAt || 0))
    .map((paper) => {
      const slug = (paper.slug || "").trim().toLowerCase();
      const title = (paper.title || slug).trim();
      const description = (paper.metadata?.metaDescription || "").trim();
      const link = toAbsoluteUrl(
        resolvePreferredPaperPath({
          slug,
          canonical: paper.metadata?.canonical,
          authorHandle: paper.metadata?.authorHandle,
          fallbackPath: `/blogs/${slug}`,
          siteUrl: baseUrl,
        }),
        baseUrl,
      );
      const pubDate = new Date(paper.updatedAt || paper.createdAt || Date.now()).toUTCString();

      return `<item>
  <title>${escapeXml(title)}</title>
  <link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  ${description ? `<description>${escapeXml(description)}</description>` : ""}
  <pubDate>${escapeXml(pubDate)}</pubDate>
</item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Whitepapper Updates</title>
  <link>${escapeXml(baseUrl)}/blogs</link>
  <description>Product updates and resources from Whitepapper.</description>
  <language>en-us</language>
  ${channelItems}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800",
    },
  });
};
