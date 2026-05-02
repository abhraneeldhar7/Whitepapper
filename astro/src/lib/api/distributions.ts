import { apiClient, type ApiClient } from "@/lib/api/client";
import { mapRequestStatus } from "@/lib/api/papers";
import type {
  DevtoDistribution,
  HashnodeDistribution,
  UserDoc,
  PaperDoc,
} from "@/lib/entities";

export interface HashnodeDistributionUpsertInput {
  accessToken: string;
  storeInCloud: boolean;
}

export interface DevtoDistributionUpsertInput {
  accessToken: string;
  storeInCloud: boolean;
}

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

export async function getHashnodeDistribution(client: ApiClient = apiClient): Promise<HashnodeDistribution | null> {
  return client.get<HashnodeDistribution | null>("/distributions/hashnode");
}

export async function saveHashnodeDistribution(
  input: HashnodeDistributionUpsertInput,
  client: ApiClient = apiClient,
): Promise<UserDoc> {
  return client.put<UserDoc>("/distributions/hashnode", {
    body: input,
  });
}

export async function revokeHashnodeDistribution(client: ApiClient = apiClient): Promise<UserDoc> {
  return client.delete<UserDoc>("/distributions/hashnode");
}

export async function publishHashnodeDistribution(
  input: DistributionPublishInput,
  client: ApiClient = apiClient,
): Promise<DistributionPublishResult> {
  const payload = input.payload ? mapRequestStatus(input.payload as Record<string, unknown>) : input.payload;
  return client.post<DistributionPublishResult>("/distributions/hashnode/publish", {
    body: { ...input, payload },
  });
}

export async function getDevtoDistribution(client: ApiClient = apiClient): Promise<DevtoDistribution | null> {
  return client.get<DevtoDistribution | null>("/distributions/devto");
}

export async function saveDevtoDistribution(
  input: DevtoDistributionUpsertInput,
  client: ApiClient = apiClient,
): Promise<UserDoc> {
  return client.put<UserDoc>("/distributions/devto", {
    body: input,
  });
}

export async function revokeDevtoDistribution(client: ApiClient = apiClient): Promise<UserDoc> {
  return client.delete<UserDoc>("/distributions/devto");
}

export async function publishDevtoDistribution(
  input: DistributionPublishInput,
  client: ApiClient = apiClient,
): Promise<DistributionPublishResult> {
  const payload = input.payload ? mapRequestStatus(input.payload as Record<string, unknown>) : input.payload;
  return client.post<DistributionPublishResult>("/distributions/devto/publish", {
    body: { ...input, payload },
  });
}
