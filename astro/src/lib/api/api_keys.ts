import { apiClient, type ApiClient } from "@/lib/api/client";

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
