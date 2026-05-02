import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");

  const body = [
    "# Whitepapper Pricing",
    "",
    "## Free",
    "- Price: $0/month",
    "- Audience: Solo developers, indie builders, technical writers",
    "- Includes: Markdown editor, public pages, Dev API, metadata workflow, distribution support, docs",
    "",
    "## Notes",
    "- Whitepapper is currently free to use.",
    "- Primary pricing page: " + `${baseUrl}/pricing`,
    "- Product category: Developer CMS, markdown publishing platform, content API",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=300",
    },
  });
};
