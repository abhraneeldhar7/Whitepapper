export function resolveIntegrationBaseUrl(
  providedBaseUrl?: string | null,
): string {
  const fromProp = String(providedBaseUrl || "").trim();
  if (fromProp) {
    return fromProp.replace(/\/+$/, "");
  }

  const isDev = Boolean(import.meta.env.DEV);
  const publicSiteBase = String((import.meta.env.PUBLIC_SITE_URL ?? "") as string).trim();

  // In local development we must not fall back to production domains.
  const fromEnv = publicSiteBase;
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (!isDev && typeof window !== "undefined") {
    return String(window.location.origin || "").trim().replace(/\/+$/, "");
  }

  return "";
}
