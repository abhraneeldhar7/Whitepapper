import { apiClient, type ApiClient } from "@/lib/api/client";
import { countImagesInContent, MAX_IMAGES_PER_PAPER, MAX_PAPER_BODY_LENGTH } from "@/lib/limits";
import type { PaperCreateResponse, PaperDoc, PaperMetadata } from "@/lib/types";

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
  status?: "draft" | "published" | "archived";
  metadata?: PaperMetadata | null;
};

export async function listStandalonePapers(
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  return client.get<PaperDoc[]>("/papers", { query: { standalone: true } });
}

export async function listOwnedPapers(
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  return client.get<PaperDoc[]>("/papers");
}

export async function listProjectPapers(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  return client.get<PaperDoc[]>("/papers", { query: { projectId } });
}

export async function getPaper(
  paperId: string,
  client: ApiClient = apiClient,
): Promise<PaperDoc> {
  return client.get<PaperDoc>(`/papers/${paperId}`);
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

  return client.patch<PaperDoc>(`/papers/${paperId}`, {
    body: input,
  });
}

export async function generatePaperMetadata(
  paperId: string,
  input: UpdatePaperInput,
  client: ApiClient = apiClient,
): Promise<PaperMetadata> {
  return client.post<PaperMetadata>(`/papers/${paperId}/metadata/generate`, {
    body: input,
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
