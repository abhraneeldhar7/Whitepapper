import { apiClient, type ApiClient } from "@/lib/api/client";
import type { PaperCreateResponse, PaperDoc } from "@/lib/types";

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
};

export async function listStandalonePapers(
  client: ApiClient = apiClient,
): Promise<PaperDoc[]> {
  return client.get<PaperDoc[]>("/papers", { query: { standalone: true } });
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
  return client.patch<PaperDoc>(`/papers/${paperId}`, {
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
