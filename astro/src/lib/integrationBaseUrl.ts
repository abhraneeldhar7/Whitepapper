export function resolveIntegrationBaseUrl(
  providedBaseUrl?: string | null,
): string {
  const fromProp = String(providedBaseUrl || "").trim();
  if (fromProp) {
    return fromProp.replace(/\/+$/, "");
  }

  const isDev = Boolean(import.meta.env.DEV);
  const productionBase = String(
    (import.meta.env.PUBLIC_PRODUCTION_BASE_URL ?? import.meta.env.PRODUCTION_BASE_URL ?? "") as string,
  ).trim();
  const publicSiteBase = String((import.meta.env.PUBLIC_SITE_URL ?? "") as string).trim();

  const fromEnv = isDev ? productionBase : (publicSiteBase || productionBase);
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (!isDev && typeof window !== "undefined") {
    return String(window.location.origin || "").trim().replace(/\/+$/, "");
  }

  return "";
}
