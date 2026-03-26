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
  };
  createdAt: string;
};

export type ProjectDoc = {
  projectId: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
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
  createdAt: string;
  updatedAt: string;
};

export type PublicAuthorSummary = {
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type PublicPaperPagePayload = {
  paper: PaperDoc;
  author: PublicAuthorSummary;
};

export type PaperCreateResponse = {
  paperId: string;
};

export type ApiKeyDoc = {
  keyId: string;
  ownerId: string;
  projectId: string;
  keyHash: string;
  usage: number;
  limitPerMonth: number;
  isActive: boolean;
  createdAt: string;
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

export type ApiKeyCreateResponse = ApiKeySummary & {
  rawKey: string;
};
