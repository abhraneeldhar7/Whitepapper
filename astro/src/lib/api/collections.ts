import { apiClient, type ApiClient } from "@/lib/api/client";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/limits";
import type { CollectionDoc } from "@/lib/types";

type CreateCollectionInput = {
  projectId: string;
  name: string;
  slug?: string;
  description?: string | null;
  isPublic?: boolean;
};

type UpdateCollectionInput = {
  name?: string;
  title?: string;
  slug?: string;
  description?: string | null;
};

export async function listProjectCollections(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<CollectionDoc[]> {
  return client.get<CollectionDoc[]>("/collections", { query: { projectId } });
}

export async function createCollection(
  input: CreateCollectionInput,
  client: ApiClient = apiClient,
): Promise<CollectionDoc> {
  const description = input.description ?? undefined;
  if (typeof description === "string" && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Collection description is too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  return client.post<CollectionDoc>("/collections", {
    body: {
      ...input,
      description,
    },
  });
}

export async function getCollection(
  collectionId: string,
  client: ApiClient = apiClient,
): Promise<CollectionDoc> {
  return client.get<CollectionDoc>(`/collections/${collectionId}`);
}

export async function updateCollection(
  collectionId: string,
  input: UpdateCollectionInput,
  client: ApiClient = apiClient,
): Promise<CollectionDoc> {
  const description = input.description ?? undefined;
  if (typeof description === "string" && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Collection description is too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  return client.patch<CollectionDoc>(`/collections/${collectionId}`, {
    body: {
      ...input,
      description,
    },
  });
}

export async function updateCollectionVisibility(
  collectionId: string,
  isPublic: boolean,
  client: ApiClient = apiClient,
): Promise<CollectionDoc> {
  return client.patch<CollectionDoc>(`/collections/${collectionId}/visibility`, {
    body: { isPublic },
  });
}

export async function deleteCollection(
  collectionId: string,
  client: ApiClient = apiClient,
): Promise<void> {
  await client.delete<{ ok: boolean }>(`/collections/${collectionId}`);
}

export async function checkCollectionSlugAvailable(
  slug: string,
  projectId: string,
  collectionId?: string,
  client: ApiClient = apiClient,
): Promise<boolean> {
  const response = await client.get<{ available: boolean }>("/collections/slug/available", {
    query: { slug, projectId, collectionId },
  });
  return response.available;
}
