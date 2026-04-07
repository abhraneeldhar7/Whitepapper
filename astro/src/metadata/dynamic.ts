import type { PaperDoc, PaperMetadata, ProjectDoc } from "@/lib/types";
import type { PageSeoConfig } from "@/metadata/pages";

type PublicPaperMetadataOptions = {
  paper: PaperDoc;
  siteUrl: string;
  handle: string;
};

type BlogPaperMetadataOptions = {
  paper: PaperDoc;
  siteUrl: string;
};

type ProfileSeoOptions = {
  handle: string;
  displayName: string;
  description: string;
  canonical: string;
  avatarUrl: string;
  username?: string | null;
};

type ProjectSeoOptions = {
  siteUrl: string;
  handle: string;
  ownerName: string;
  description: string;
  project: ProjectDoc;
  papers: PaperDoc[];
  logoUrl: string;
};

function ensureSiteUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeBlogCanonical(candidate: string, fallbackCanonical: string): string {
  const normalizedCandidate = String(candidate || "").trim();
  const isBlogCanonical = /\/blogs\/[^/]+\/?$/i.test(normalizedCandidate);
  return isBlogCanonical ? normalizedCandidate : fallbackCanonical;
}

function toPaperMetadataBase(paper: PaperDoc, siteUrl: string) {
  const metadataInput = paper.metadata;
  const fallbackImage = paper.thumbnailUrl || `${siteUrl}/appLogo.png`;

  return {
    metadataInput,
    fallbackImage,
    ogTags: Array.isArray(metadataInput?.ogTags) ? metadataInput.ogTags : [],
    isAccessibleForFree:
      typeof metadataInput?.isAccessibleForFree === "boolean"
        ? metadataInput.isAccessibleForFree
        : true,
    license: metadataInput?.license || "https://creativecommons.org/licenses/by/4.0/",
  };
}

export function buildPublicPaperMetadata(options: PublicPaperMetadataOptions): PaperMetadata {
  const { paper, siteUrl, handle } = options;
  const { metadataInput, fallbackImage, ogTags, isAccessibleForFree, license } = toPaperMetadataBase(paper, siteUrl);

  const normalizedHandle = handle.trim().toLowerCase();
  const authorHandle = (metadataInput?.authorHandle || normalizedHandle)
    .trim()
    .toLowerCase();
  const fallbackCanonical = `${siteUrl}/${normalizedHandle}/${paper.slug}`;
  const fallbackAuthorUrl = `${siteUrl}/${authorHandle}`;

  return {
    title: metadataInput?.title || `${paper.title} | Whitepapper`,
    metaDescription: metadataInput?.metaDescription || paper.title,
    canonical: metadataInput?.canonical || fallbackCanonical,
    robots:
      metadataInput?.robots ||
      (paper.status === "published" ? "index, follow" : "noindex, nofollow"),
    ogTitle: metadataInput?.ogTitle || paper.title,
    ogDescription:
      metadataInput?.ogDescription ||
      metadataInput?.metaDescription ||
      paper.title,
    ogImage: metadataInput?.ogImage || fallbackImage,
    ogImageWidth: metadataInput?.ogImageWidth || 1200,
    ogImageHeight: metadataInput?.ogImageHeight || 630,
    ogImageAlt: metadataInput?.ogImageAlt || `Cover image for ${paper.title}`,
    ogLocale: metadataInput?.ogLocale || "en_US",
    ogPublishedTime:
      metadataInput?.ogPublishedTime ||
      metadataInput?.datePublished ||
      paper.createdAt,
    ogModifiedTime:
      metadataInput?.ogModifiedTime || metadataInput?.dateModified || paper.updatedAt,
    ogAuthorUrl:
      metadataInput?.ogAuthorUrl || metadataInput?.authorUrl || fallbackAuthorUrl,
    ogTags,
    twitterTitle: metadataInput?.twitterTitle || paper.title,
    twitterDescription:
      metadataInput?.twitterDescription ||
      metadataInput?.metaDescription ||
      paper.title,
    twitterImage:
      metadataInput?.twitterImage || metadataInput?.ogImage || fallbackImage,
    twitterImageAlt:
      metadataInput?.twitterImageAlt || `Cover image for ${paper.title}`,
    twitterCreator: metadataInput?.twitterCreator || null,
    headline: metadataInput?.headline || paper.title,
    abstract:
      metadataInput?.abstract || metadataInput?.metaDescription || paper.title,
    keywords: metadataInput?.keywords || "",
    articleSection: metadataInput?.articleSection || "General",
    wordCount: metadataInput?.wordCount || 0,
    readingTimeMinutes: metadataInput?.readingTimeMinutes || 1,
    inLanguage: metadataInput?.inLanguage || "en",
    datePublished:
      metadataInput?.datePublished ||
      metadataInput?.ogPublishedTime ||
      paper.createdAt,
    dateModified:
      metadataInput?.dateModified || metadataInput?.ogModifiedTime || paper.updatedAt,
    authorName: metadataInput?.authorName || authorHandle,
    authorHandle,
    authorUrl: metadataInput?.authorUrl || fallbackAuthorUrl,
    authorId: metadataInput?.authorId || "",
    coverImageUrl:
      metadataInput?.coverImageUrl || metadataInput?.ogImage || fallbackImage,
    publisherName: metadataInput?.publisherName || "Whitepapper",
    publisherUrl: metadataInput?.publisherUrl || siteUrl,
    isAccessibleForFree,
    license,
  };
}

export function buildBlogPaperMetadata(options: BlogPaperMetadataOptions): PaperMetadata {
  const { paper, siteUrl } = options;
  const { metadataInput, fallbackImage, ogTags, isAccessibleForFree, license } = toPaperMetadataBase(paper, siteUrl);

  const authorHandle = (metadataInput?.authorHandle || "whitepapper")
    .trim()
    .toLowerCase();
  const fallbackCanonical = `${siteUrl}/blogs/${paper.slug}`;
  const fallbackAuthorUrl = `${siteUrl}/blogs`;

  return {
    title: metadataInput?.title || `${paper.title} | Whitepapper Blog`,
    metaDescription: metadataInput?.metaDescription || paper.title,
    canonical: normalizeBlogCanonical(metadataInput?.canonical || "", fallbackCanonical),
    robots:
      metadataInput?.robots ||
      (paper.status === "published" ? "index, follow" : "noindex, nofollow"),
    ogTitle: metadataInput?.ogTitle || paper.title,
    ogDescription:
      metadataInput?.ogDescription ||
      metadataInput?.metaDescription ||
      paper.title,
    ogImage: metadataInput?.ogImage || fallbackImage,
    ogImageWidth: metadataInput?.ogImageWidth || 1200,
    ogImageHeight: metadataInput?.ogImageHeight || 630,
    ogImageAlt: metadataInput?.ogImageAlt || `Cover image for ${paper.title}`,
    ogLocale: metadataInput?.ogLocale || "en_US",
    ogPublishedTime:
      metadataInput?.ogPublishedTime ||
      metadataInput?.datePublished ||
      paper.createdAt,
    ogModifiedTime:
      metadataInput?.ogModifiedTime ||
      metadataInput?.dateModified ||
      paper.updatedAt,
    ogAuthorUrl:
      metadataInput?.ogAuthorUrl ||
      metadataInput?.authorUrl ||
      fallbackAuthorUrl,
    ogTags,
    twitterTitle: metadataInput?.twitterTitle || paper.title,
    twitterDescription:
      metadataInput?.twitterDescription ||
      metadataInput?.metaDescription ||
      paper.title,
    twitterImage:
      metadataInput?.twitterImage || metadataInput?.ogImage || fallbackImage,
    twitterImageAlt:
      metadataInput?.twitterImageAlt || `Cover image for ${paper.title}`,
    twitterCreator: metadataInput?.twitterCreator || null,
    headline: metadataInput?.headline || paper.title,
    abstract:
      metadataInput?.abstract ||
      metadataInput?.metaDescription ||
      paper.title,
    keywords: metadataInput?.keywords || "",
    articleSection: metadataInput?.articleSection || "General",
    wordCount: metadataInput?.wordCount || 0,
    readingTimeMinutes: metadataInput?.readingTimeMinutes || 1,
    inLanguage: metadataInput?.inLanguage || "en",
    datePublished:
      metadataInput?.datePublished ||
      metadataInput?.ogPublishedTime ||
      paper.createdAt,
    dateModified:
      metadataInput?.dateModified ||
      metadataInput?.ogModifiedTime ||
      paper.updatedAt,
    authorName: metadataInput?.authorName || authorHandle,
    authorHandle,
    authorUrl: metadataInput?.authorUrl || fallbackAuthorUrl,
    authorId: metadataInput?.authorId || "",
    coverImageUrl:
      metadataInput?.coverImageUrl || metadataInput?.ogImage || fallbackImage,
    publisherName: metadataInput?.publisherName || "Whitepapper",
    publisherUrl: metadataInput?.publisherUrl || siteUrl,
    isAccessibleForFree,
    license,
  };
}

function buildPaperJsonLd(metadata: PaperMetadata, schemaType: "Article" | "BlogPosting") {
  const publisherUrl = metadata.publisherUrl;
  const publisherLogoUrl = `${publisherUrl.replace(/\/+$/, "")}/appLogo.png`;

  return {
    "@context": "https://schema.org",
    "@type": schemaType,
    headline: metadata.headline,
    description: metadata.metaDescription,
    abstract: metadata.abstract,
    keywords: metadata.keywords,
    articleSection: metadata.articleSection,
    wordCount: metadata.wordCount,
    inLanguage: metadata.inLanguage,
    isAccessibleForFree: metadata.isAccessibleForFree,
    license: metadata.license,
    url: metadata.canonical,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": metadata.canonical,
    },
    datePublished: metadata.datePublished,
    dateModified: metadata.dateModified,
    author: {
      "@type": "Person",
      name: metadata.authorName,
      url: metadata.authorUrl,
      identifier: metadata.authorId,
    },
    image: {
      "@type": "ImageObject",
      url: metadata.coverImageUrl,
      width: metadata.ogImageWidth,
      height: metadata.ogImageHeight,
    },
    publisher: {
      "@type": "Organization",
      name: metadata.publisherName,
      url: publisherUrl,
      logo: {
        "@type": "ImageObject",
        url: publisherLogoUrl,
        width: 200,
        height: 60,
      },
    },
  };
}

function buildPaperBreadcrumbJsonLd(items: Array<{ position: number; name: string; item: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry) => ({
      "@type": "ListItem",
      position: entry.position,
      name: entry.name,
      item: entry.item,
    })),
  };
}

export function buildPaperSeoConfig(metadata: PaperMetadata, options: {
  schemaType: "Article" | "BlogPosting";
  breadcrumbItems: Array<{ position: number; name: string; item: string }>;
}): PageSeoConfig {
  return {
    path: metadata.canonical,
    title: metadata.title,
    description: metadata.metaDescription,
    canonical: metadata.canonical,
    image: metadata.ogImage,
    keywords: metadata.keywords,
    robots: metadata.robots,
    author: metadata.authorName,
    siteName: metadata.publisherName,
    locale: metadata.ogLocale,
    ogType: "article",
    ogTitle: metadata.ogTitle,
    ogDescription: metadata.ogDescription,
    ogUrl: metadata.canonical,
    ogImage: metadata.ogImage,
    ogImageAlt: metadata.ogImageAlt,
    ogImageWidth: metadata.ogImageWidth,
    ogImageHeight: metadata.ogImageHeight,
    ogLocale: metadata.ogLocale,
    ogPublishedTime: metadata.ogPublishedTime,
    ogModifiedTime: metadata.ogModifiedTime,
    ogAuthorUrl: metadata.ogAuthorUrl,
    ogTags: metadata.ogTags,
    twitterCard: "summary_large_image",
    twitterTitle: metadata.twitterTitle,
    twitterDescription: metadata.twitterDescription,
    twitterImage: metadata.twitterImage,
    twitterImageAlt: metadata.twitterImageAlt,
    twitterCreator: metadata.twitterCreator || "",
    articleSection: metadata.articleSection,
    articlePublishedTime: metadata.ogPublishedTime,
    articleModifiedTime: metadata.ogModifiedTime,
    articleAuthor: metadata.ogAuthorUrl,
    articleTags: metadata.ogTags,
    jsonLd: [
      buildPaperJsonLd(metadata, options.schemaType),
      buildPaperBreadcrumbJsonLd(options.breadcrumbItems),
    ],
  };
}

export function buildProfileSeo(options: ProfileSeoOptions): PageSeoConfig {
  const normalizedTitle = `${options.displayName} | Whitepapper`;

  return {
    path: options.canonical,
    title: normalizedTitle,
    description: options.description,
    canonical: options.canonical,
    image: options.avatarUrl,
    robots: "index,follow",
    author: options.displayName,
    ogType: "profile",
    ogTitle: normalizedTitle,
    ogDescription: options.description,
    ogUrl: options.canonical,
    ogImage: options.avatarUrl,
    twitterCard: "summary",
    twitterTitle: normalizedTitle,
    twitterDescription: options.description,
    twitterImage: options.avatarUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      name: normalizedTitle,
      description: options.description,
      url: options.canonical,
      mainEntity: {
        "@type": "Person",
        name: options.displayName,
        alternateName: options.username || options.handle,
        url: options.canonical,
        description: options.description,
        image: options.avatarUrl,
        sameAs: [options.canonical],
      },
    },
  };
}

export function buildProjectSeo(options: ProjectSeoOptions): PageSeoConfig {
  const siteUrl = ensureSiteUrl(options.siteUrl);
  const canonical = `${siteUrl}/${options.handle}/p/${options.project.slug}`;
  const pageTitle = `${options.project.name} | ${options.ownerName} | Whitepapper`;

  const collectionPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: options.project.name,
    description: options.description,
    url: canonical,
    creator: {
      "@type": "Person",
      name: options.ownerName,
      url: `${siteUrl}/${options.handle}`,
    },
    image: options.logoUrl,
    dateCreated: options.project.createdAt,
    dateModified: options.project.updatedAt,
    hasPart: (options.papers || [])
      .filter((paper) => !paper.collectionId)
      .slice(0, 20)
      .map((paper) => ({
        "@type": "Article",
        headline: paper.title,
        url: `${siteUrl}/${options.handle}/${paper.slug}`,
        dateModified: paper.updatedAt,
      })),
  };

  return {
    path: canonical,
    title: pageTitle,
    description: options.description,
    canonical,
    image: options.logoUrl,
    robots: "index,follow",
    author: options.ownerName,
    ogType: "website",
    ogTitle: `${options.project.name} | Whitepapper`,
    ogDescription: options.description,
    ogUrl: canonical,
    ogImage: options.logoUrl,
    twitterCard: "summary_large_image",
    twitterTitle: `${options.project.name} | Whitepapper`,
    twitterDescription: options.description,
    twitterImage: options.logoUrl,
    jsonLd: collectionPageJsonLd,
  };
}
