import { apiClient, type ApiClient } from "@/lib/api/client";
import type { CollectionDoc } from "@/lib/types";

type CreateCollectionInput = {
  projectId: string;
  name: string;
  slug: string;
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
  return client.post<CollectionDoc>("/collections", {
    body: input,
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
  return client.patch<CollectionDoc>(`/collections/${collectionId}`, {
    body: input,
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
