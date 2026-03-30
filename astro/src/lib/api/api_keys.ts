import { apiClient, type ApiClient } from "@/lib/api/client";
import type { ApiKeySummary, ApiKeyCreateResponse } from "@/lib/types";

export type { ApiKeySummary, ApiKeyCreateResponse };

export async function getProjectApiKey(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<ApiKeySummary | null> {
  return client.get<ApiKeySummary | null>(`/projects/${projectId}/api-key`);
}

export async function createApiKey(
  input: {
    projectId: string;
  },
  client: ApiClient = apiClient,
): Promise<ApiKeyCreateResponse> {
  return client.post<ApiKeyCreateResponse>(`/projects/${input.projectId}/api-key`, {});
}

export async function setApiKeyActive(
  keyId: string,
  isActive: boolean,
  client: ApiClient = apiClient,
): Promise<ApiKeySummary> {
  return client.patch<ApiKeySummary>(`/api-keys/${keyId}`, {
    body: { isActive },
  });
}

export async function resetApiKey(
  keyId: string,
  client: ApiClient = apiClient,
): Promise<ApiKeyCreateResponse> {
  return client.post<ApiKeyCreateResponse>(`/api-keys/${keyId}/reset`, {});
}
