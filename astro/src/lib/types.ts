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

export type DistributionDoc = {
  userId: string;
  hashnode?: HashnodeDistribution | null;
  devto?: DevtoDistribution | null;
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
};

export type DistributionPublishInput = {
  paperId: string;
  payload?: PaperDoc | null;
  accessToken?: string | null;
};

export type DistributionPublishResult = {
  platform: "hashnode" | "devto";
  postId: string;
  url?: string | null;
};

export type PublicAuthorSummary = {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type PublicPaperPagePayload = {
  paper: PaperDoc;
};

export type PaperCreateResponse = {
  paperId: string;
};

export type ApiKeySummary = {
  keyId: string;
  ownerId: string;
  projectId: string;
  usage: number;
  limitPerMonth: number;
  isActive: boolean;
  createdAt: string;
};

export type ApiKeyDoc = ApiKeySummary;

export type ApiKeyCreateResponse = ApiKeySummary & {
  rawKey: string;
};

export type McpTokenSummary = {
  tokenId: string;
  projectId: string;
  workspaceId: string;
  label?: string | null;
  createdAt: string;
  usage: number;
  limitPerMonth: number;
};

export type McpOAuthRequestSummary = {
  requestId: string;
  clientId: string;
  clientName?: string | null;
  scopes: string[];
};

export type McpConnectionInfo = {
  serverName: string;
  transport: "http";
  endpointUrl: string;
  manualConfig: {
    servers: Record<
      string,
      {
        url: string;
        type: "http";
      }
    >;
    inputs: unknown[];
  };
};
