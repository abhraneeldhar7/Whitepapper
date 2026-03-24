import { apiClient, type ApiClient } from "@/lib/api/client";
import type { ApiKeyDoc, ApiKeyCreateResponse } from "@/lib/types";

export type { ApiKeyDoc, ApiKeyCreateResponse };


export async function getProjectApiKey(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<ApiKeyDoc | null> {
  return client.get<ApiKeyDoc | null>(`/projects/${projectId}/api-key`);
}

export async function createApiKey(
  input: {
    projectId: string;
  },
  client: ApiClient = apiClient,
): Promise<ApiKeyCreateResponse> {
  return client.post<ApiKeyCreateResponse>(`/projects/${input.projectId}/api-key`, {
  });
}

export async function setApiKeyActive(
  keyId: string,
  isActive: boolean,
  client: ApiClient = apiClient,
): Promise<ApiKeyDoc> {
  return client.patch<ApiKeyDoc>(`/api-keys/${keyId}`, {
    body: { isActive },
  });
}

export async function deleteApiKey(
  keyId: string,
  client: ApiClient = apiClient,
): Promise<void> {
  await client.delete<{ ok: boolean }>(`/api-keys/${keyId}`);
}
