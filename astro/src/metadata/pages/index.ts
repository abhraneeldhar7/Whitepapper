import about from "./about.json";
import blogs from "./blogs.json";
import contact from "./contact.json";
import dashboard from "./dashboard.json";
import docs from "./docs.json";
import error404 from "./404.json";
import home from "./home.json";
import integrations from "./integrations.json";
import login from "./login.json";
import privacyPolicy from "./privacy-policy.json";
import resources from "./resources.json";
import settings from "./settings.json";
import termsOfService from "./terms-of-service.json";
import unauthorized from "./unauthorized.json";
import updates from "./updates.json";
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
  [contact.path]: contact,
  [docs.path]: docs,
  [integrations.path]: integrations,
  [privacyPolicy.path]: privacyPolicy,
  [resources.path]: resources,
  [termsOfService.path]: termsOfService,
  [updates.path]: updates,
  [login.path]: login,
  [dashboard.path]: dashboard,
  [settings.path]: settings,
  [write.path]: write,
  [unauthorized.path]: unauthorized,
  [welcome.path]: welcome,
  [error404.path]: error404,
};

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const normalized = pathname.trim();
  if (!normalized || normalized === "/") return "/";
  return normalized.replace(/\/+$/, "");
}

export function getPageSeoConfig(pathname: string): PageSeoConfig | null {
  const normalizedPathname = normalizePathname(pathname);

  if (PAGE_SEO_BY_PATH[normalizedPathname]) {
    return PAGE_SEO_BY_PATH[normalizedPathname];
  }

  if (normalizedPathname.startsWith("/dashboard/")) {
    return PAGE_SEO_BY_PATH["/dashboard"];
  }

  if (normalizedPathname.startsWith("/settings/")) {
    return PAGE_SEO_BY_PATH["/settings"];
  }

  if (normalizedPathname.startsWith("/write/")) {
    return PAGE_SEO_BY_PATH["/write"];
  }

  return null;
}
