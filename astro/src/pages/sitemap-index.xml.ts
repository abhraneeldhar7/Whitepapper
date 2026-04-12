import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site, url }) => {
  const baseUrl = (site?.toString() || url.origin).replace(/\/+$/, "");
  return Response.redirect(`${baseUrl}/sitemap.xml`, 301);
};
