import { apiClient, type ApiClient } from "@/lib/api/client";
import { countImagesInContent, MAX_IMAGES_PER_PAPER, MAX_PAPER_BODY_LENGTH } from "@/lib/limits";
import { sortPapersLatestFirst } from "@/lib/paperSort";
import type { PaperDoc, PaperMetadata } from "@/lib/entities";

const API_STATUS_MAP: Record<string, "draft" | "public"> = {
  draft: "draft",
  published: "public",
  archived: "draft",
};

const FRONTEND_STATUS_MAP: Record<string, "draft" | "published"> = {
  draft: "draft",
  public: "published",
};

function mapResponseStatus(paper: Record<string, unknown>): PaperDoc {
  return {
    ...paper,
    status: API_STATUS_MAP[String(paper.status)] ?? "draft",
  } as unknown as PaperDoc;
}

function mapRequestStatus(input: Record<string, unknown>): Record<string, unknown> {
  if (input.status && typeof input.status === "string") {
    return { ...input, status: FRONTEND_STATUS_MAP[input.status] ?? input.status };
  }
  return input;
}

export type PaperCreateResponse = {
  paperId: string;
};

type CreatePaperInput = {
  title?: string;
  projectId?: string | null;
  collectionId?: string | null;
};

type UpdatePaperInput = {
  collectionId?: string | null;
  projectId?: string | null;
  thumbnailUrl?: string | null;
  title?: string;
  slug?: string;
  body?: string;
  status?: "draft" | "public";
  metadata?: PaperMetadata | null;
};

function mapPapers(papers: Record<string, unknown>[]): PaperDoc[] {
  return papers.map((p) => mapResponseStatus(p));
}

export async function listStandalonePapers(
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  const papers = await client.get<Record<string, unknown>[]>("/papers", { query: { standalone: true } });
  return sortPapersLatestFirst(mapPapers(papers || []));
}

export async function listOwnedPapers(
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  const papers = await client.get<Record<string, unknown>[]>("/papers");
  return sortPapersLatestFirst(mapPapers(papers || []));
}

export async function listProjectPapers(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  const papers = await client.get<Record<string, unknown>[]>("/papers", { query: { projectId } });
  return sortPapersLatestFirst(mapPapers(papers || []));
}

export async function listCollectionPapers(
  collectionId: string,
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  const papers = await client.get<Record<string, unknown>[]>(`/collections/${collectionId}/papers`);
  return sortPapersLatestFirst(mapPapers(papers || []));
}

export async function getPaper(
  paperId: string,
  client: ApiClient = apiClient,
): Promise<PaperDoc> {
  const paper = await client.get<Record<string, unknown>>(`/papers/${paperId}`);
  return mapResponseStatus(paper);
}

export async function createPaper(
  input: CreatePaperInput,
  client: ApiClient = apiClient,
): Promise<PaperCreateResponse> {
  return client.post<PaperCreateResponse>("/papers", {
    body: {
      title: input.title,
      projectId: input.projectId ?? null,
      collectionId: input.collectionId ?? null,
    },
  });
}

export async function updatePaper(
  paperId: string,
  input: UpdatePaperInput,
  client: ApiClient = apiClient,
): Promise<PaperDoc> {
  if (typeof input.body === "string") {
    if (input.body.length > MAX_PAPER_BODY_LENGTH) {
      throw new Error(`Paper content is too long. Maximum length is ${MAX_PAPER_BODY_LENGTH} characters.`);
    }

    const imageCount = countImagesInContent(input.body);
    if (imageCount > MAX_IMAGES_PER_PAPER) {
      throw new Error(`Paper image limit reached (${MAX_IMAGES_PER_PAPER}). Remove some images before saving.`);
    }
  }

  const mappedInput = mapRequestStatus(input as unknown as Record<string, unknown>);
  const updated = await client.patch<Record<string, unknown>>(`/papers/${paperId}`, {
    body: mappedInput,
  });
  return mapResponseStatus(updated);
}

export async function generatePaperMetadata(
  paperId: string,
  paperDoc: PaperDoc,
  client: ApiClient = apiClient,
): Promise<PaperMetadata> {
  return client.post<PaperMetadata>(`/papers/${paperId}/metadata/preview`, {
    body: {
      payload: paperDoc,
    },
  });
}

export async function deletePaper(
  paperId: string,
  client: ApiClient = apiClient,
): Promise<void> {
  await client.delete<{ ok: boolean }>(`/papers/${paperId}`);
}

export async function checkPaperSlugAvailable(
  slug: string,
  paperId: string,
  client: ApiClient = apiClient,
): Promise<boolean> {
  const response = await client.get<{ available: boolean }>("/papers/slug/available", {
    query: { slug, paperId },
  });
  return response.available;
}
