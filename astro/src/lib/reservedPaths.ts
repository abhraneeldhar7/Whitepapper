import { normalizeSlug } from "@/lib/utils";

export const RESERVED_ROOT_PATHS = [
  "api",
  "dashboard",
  "write",
  "settings",
  "login",
  "welcome",
  "unauthorized",
  "404",
  "about",
  "contact",
  "integrations",
  "blogs",
  "updates",
  "resources",
  "features",
  "use-cases",
  "compare",
  "glossary",
  "pricing",
  "pricing.md",
  "rss.xml",
  "llms.txt",
  "llms-full.txt",
  "sitemap.xml",
  "sitemap-index.xml",
  "sitemaps",
  "privacy-policy",
  "terms-of-service",
  "docs",
  "_astro",
  "favicon.ico",
] as const;

const RESERVED_USERNAME_SET = new Set<string>(
  RESERVED_ROOT_PATHS.map((path) => normalizePathSegment(path)).filter(Boolean),
);
export function normalizePathSegment(value: string): string {
  return normalizeSlug(value);
}

export function isSlugFormatValid(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isReservedUsername(value: string): boolean {
  const normalized = normalizePathSegment(value);
  return Boolean(normalized) && RESERVED_USERNAME_SET.has(normalized);
}


