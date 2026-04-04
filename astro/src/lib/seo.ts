export function resolveSiteUrl(candidate: string | undefined | null, fallbackOrigin: string): string {
  const resolved = String(candidate || fallbackOrigin).trim().replace(/\/+$/, "");
  return resolved || fallbackOrigin.replace(/\/+$/, "");
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
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}
