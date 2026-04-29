export function resolveSiteUrl(candidate: string | undefined | null, fallbackOrigin = ""): string {
  const resolved = String(candidate || fallbackOrigin).trim().replace(/\/+$/, "");
  return resolved || fallbackOrigin.replace(/\/+$/, "");
}

export function normalizeHandle(candidate: string | undefined | null): string {
  return String(candidate || "").trim().replace(/^@+/, "").toLowerCase();
}

export function absoluteUrl(pathOrUrl: string, siteUrl: string): string {
  const value = String(pathOrUrl || "").trim();
  if (!value) return siteUrl;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${siteUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function fallbackDescription(primary: string | undefined | null, fallback: string): string {
  const normalized = String(primary || "").trim();
  if (normalized) return normalized;
  return fallback.trim();
}

export function excerpt(text: string | undefined | null, maxLength = 160): string {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function stripMarkdown(text: string | undefined | null): string {
  const raw = String(text || "");
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1 ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerptFromMarkdown(text: string | undefined | null, maxLength = 160): string {
  return excerpt(stripMarkdown(text), maxLength);
}

export function countWords(text: string | undefined | null): number {
  const normalized = stripMarkdown(text);
  if (!normalized) return 0;
  return normalized.match(/\b[\w'-]+\b/g)?.length ?? 0;
}

export function estimateReadingTimeMinutes(text: string | undefined | null, wordsPerMinute = 220): number {
  const words = countWords(text);
  if (!words) return 1;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

export function isPlaceholderHref(href: string | undefined | null): boolean {
  return String(href || "").trim() === "#";
}

export function isAbsoluteUrl(value: string | undefined | null): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

export function resolvePathname(candidate: string | undefined | null, siteUrl = ""): string {
  if (!siteUrl) return String(candidate || "").replace(/\/+$/, "") || "/";
  const value = String(candidate || "").trim();
  if (!value) return "";
  try {
    return new URL(value, siteUrl).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return "";
  }
}

export function isInternalHref(candidate: string | undefined | null, siteUrl: string): boolean {
  const value = String(candidate || "").trim();
  if (!value) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  if (!isAbsoluteUrl(value)) return false;

  try {
    const target = new URL(value);
    const site = new URL(siteUrl);
    return target.origin === site.origin;
  } catch {
    return false;
  }
}

type ResolvePreferredPaperPathOptions = {
  slug: string;
  canonical?: string | null;
  authorHandle?: string | null;
  fallbackHandle?: string | null;
  fallbackPath?: string | null;
  siteUrl?: string | null;
};

export function resolvePreferredPaperPath(options: ResolvePreferredPaperPathOptions): string {
  const slug = String(options.slug || "").trim().toLowerCase();
  const siteUrl = resolveSiteUrl(options.siteUrl);
  const canonical = String(options.canonical || "").trim();
  const canonicalPath = resolvePathname(canonical, siteUrl);
  const normalizedAuthorHandle = normalizeHandle(options.authorHandle);
  const normalizedFallbackHandle = normalizeHandle(options.fallbackHandle);
  const defaultFallbackPath = options.fallbackPath?.trim() || (slug ? `/blogs/${slug}` : "/blogs");

  if (canonical && isAbsoluteUrl(canonical) && !isInternalHref(canonical, siteUrl)) {
    return canonical;
  }

  if (
    canonicalPath &&
    canonicalPath !== `/blogs/${slug}` &&
    /^\/[^/]+\/[^/]+$/i.test(canonicalPath)
  ) {
    return canonicalPath;
  }

  if (normalizedAuthorHandle && slug) {
    return `/${normalizedAuthorHandle}/${slug}`;
  }

  if (normalizedFallbackHandle && slug) {
    return `/${normalizedFallbackHandle}/${slug}`;
  }

  if (canonicalPath) {
    return canonicalPath;
  }

  return defaultFallbackPath;
}
