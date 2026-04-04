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
  "privacy-policy",
  "terms-of-service",
  "docs",
  "_astro",
  "favicon.ico",
] as const;

const RESERVED_USERNAME_SET = new Set<string>(
  RESERVED_ROOT_PATHS.map((path) => normalizePathSegment(path)).filter(Boolean),
);
const RESERVED_PAPER_SLUG_SET = new Set<string>();
const RESERVED_PROJECT_SLUG_SET = new Set<string>();

export function normalizePathSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isSlugFormatValid(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function isReservedUsername(value: string): boolean {
  const normalized = normalizePathSegment(value);
  return Boolean(normalized) && RESERVED_USERNAME_SET.has(normalized);
}

export function isReservedPaperSlug(value: string): boolean {
  const normalized = normalizePathSegment(value);
  return Boolean(normalized) && RESERVED_PAPER_SLUG_SET.has(normalized);
}

export function isReservedProjectSlug(value: string): boolean {
  const normalized = normalizePathSegment(value);
  return Boolean(normalized) && RESERVED_PROJECT_SLUG_SET.has(normalized);
}
