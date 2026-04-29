import about from "./about.json";
import blogs from "./blogs.json";
import compare from "./compare.json";
import components from "./components.json";
import contact from "./contact.json";
import dashboard from "./dashboard.json";
import docs from "./docs.json";
import error404 from "./404.json";
import features from "./features.json";
import glossary from "./glossary.json";
import home from "./home.json";
import integrations from "./integrations.json";
import login from "./login.json";
import pricing from "./pricing.json";
import privacyPolicy from "./privacy-policy.json";
import resources from "./resources.json";
import settings from "./settings.json";
import termsOfService from "./terms-of-service.json";
import unauthorized from "./unauthorized.json";
import updates from "./updates.json";
import useCases from "./use-cases.json";
import welcome from "./welcome.json";
import write from "./write.json";

export type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

export type PageSeoConfig = {
  path: string;
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  keywords?: string;
  robots?: string;
  author?: string;
  siteName?: string;
  locale?: string;
  ogType?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogUrl?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  ogLocale?: string;
  ogPublishedTime?: string;
  ogModifiedTime?: string;
  ogAuthorUrl?: string;
  ogTags?: string[];
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  twitterImageAlt?: string;
  twitterCreator?: string;
  twitterSite?: string;
  articleSection?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleAuthor?: string;
  articleTags?: string[];
  jsonLd?: JsonLdValue;
};

const PAGE_SEO_BY_PATH: Record<string, PageSeoConfig> = {
  [home.path]: home,
  [about.path]: about,
  [blogs.path]: blogs,
  [compare.path]: compare,
  [components.path]: components,
  [contact.path]: contact,
  [dashboard.path]: dashboard,
  [docs.path]: docs,
  [error404.path]: error404,
  [features.path]: features,
  [glossary.path]: glossary,
  [integrations.path]: integrations,
  [login.path]: login,
  [pricing.path]: pricing,
  [privacyPolicy.path]: privacyPolicy,
  [resources.path]: resources,
  [settings.path]: settings,
  [termsOfService.path]: termsOfService,
  [unauthorized.path]: unauthorized,
  [updates.path]: updates,
  [useCases.path]: useCases,
  [welcome.path]: welcome,
  [write.path]: write,
};

function normalizeJsonLdItems(value?: JsonLdValue): Record<string, unknown>[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function mergePageSeoConfig(
  base: PageSeoConfig | null,
  override: PageSeoConfig | null,
): PageSeoConfig | null {
  if (!base && !override) {
    return null;
  }

  const merged: PageSeoConfig = {
    ...(base || {}),
    ...(override || {}),
    path: override?.path || base?.path || "/",
  };

  const baseJsonLd = normalizeJsonLdItems(base?.jsonLd);
  const overrideJsonLd = normalizeJsonLdItems(override?.jsonLd);
  if (baseJsonLd.length || overrideJsonLd.length) {
    merged.jsonLd = [...baseJsonLd, ...overrideJsonLd];
  }

  return merged;
}

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const normalized = pathname.trim();
  if (!normalized || normalized === "/") return "/";
  return normalized.replace(/\/+$/, "");
}

function resolveAliasPath(pathname: string): string {
  if (pathname.startsWith("/dashboard/")) {
    return "/dashboard";
  }

  if (pathname.startsWith("/settings/")) {
    return "/settings";
  }

  if (pathname.startsWith("/write/")) {
    return "/write";
  }

  return pathname;
}

export function getPageSeoConfig(pathname: string): PageSeoConfig | null {
  const normalizedPathname = normalizePathname(pathname);
  return PAGE_SEO_BY_PATH[normalizedPathname] || PAGE_SEO_BY_PATH[resolveAliasPath(normalizedPathname)] || null;
}
