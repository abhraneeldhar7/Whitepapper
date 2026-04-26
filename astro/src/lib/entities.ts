export type UserDoc = {
  userId: string;
  displayName?: string | null;
  description: string;
  email?: string | null;
  avatarUrl?: string | null;
  username: string;
  plan: "free" | "pro";
  preferences?: {
    showKeyboardEffect?: boolean;
    typingSoundEnabled?: boolean;
    hashnodeStoreInCloud?: boolean;
    hashnodeIntegrated?: boolean;
    devtoStoreInCloud?: boolean;
    devtoIntegrated?: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type HashnodeDistribution = {
  accessToken?: string | null;
  publicationId?: string | null;
};

export type DevtoDistribution = {
  accessToken?: string | null;
};

export type ProjectDoc = {
  projectId: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  contentGuidelines: string;
  logoUrl?: string | null;
  isPublic: boolean;
  pagesNumber: number;
  createdAt: string;
  updatedAt: string;
};

export type CollectionDoc = {
  collectionId: string;
  projectId: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  pagesNumber: number;
};

export type PaperDoc = {
  paperId: string;
  collectionId?: string | null;
  projectId?: string | null;
  ownerId: string;
  thumbnailUrl?: string | null;
  title: string;
  slug: string;
  body: string;
  status: "draft" | "published" | "archived";
  metadata?: PaperMetadata | null;
  createdAt: string;
  updatedAt: string;
};

export type PaperMetadata = {
  title: string;
  metaDescription: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageWidth: number;
  ogImageHeight: number;
  ogImageAlt: string;
  ogLocale: string;
  ogPublishedTime: string;
  ogModifiedTime: string;
  ogAuthorUrl: string;
  ogTags: string[];
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
  twitterCreator?: string | null;
  headline: string;
  abstract: string;
  keywords: string;
  articleSection: string;
  wordCount: number;
  readingTimeMinutes: number;
  inLanguage: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorHandle: string;
  authorUrl: string;
  authorId: string;
  coverImageUrl: string;
  publisherName: string;
  publisherUrl: string;
  isAccessibleForFree: boolean;
  license: string;
  // New AI/SEO fields
  keyTakeaways?: string[] | null;
  faq?: Array<{ question: string; answer: string }> | null;
  author_bio?: string | null;
  jsonld?: Record<string, any> | Array<Record<string, any>> | null;
};
