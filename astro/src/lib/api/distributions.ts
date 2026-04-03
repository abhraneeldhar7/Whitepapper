import { apiClient, type ApiClient } from "@/lib/api/client";
import type {
  DevtoDistribution,
  DistributionPublishInput,
  DistributionPublishResult,
  HashnodeDistribution,
  UserDoc,
} from "@/lib/types";

export interface HashnodeDistributionUpsertInput {
  accessToken: string;
  storeInCloud: boolean;
}

export interface DevtoDistributionUpsertInput {
  accessToken: string;
  storeInCloud: boolean;
}

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
  return client.post<DistributionPublishResult>("/distributions/hashnode/publish", {
    body: input,
  });
}

export async function getDevtoDistribution(client: ApiClient = apiClient): Promise<DevtoDistribution | null> {
  try {
    return await client.get<DevtoDistribution | null>("/distributions/devto");
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    return client.get<DevtoDistribution | null>("/distributions/devto");
  }
}

export async function saveDevtoDistribution(
  input: DevtoDistributionUpsertInput,
  client: ApiClient = apiClient,
): Promise<UserDoc> {
  try {
    return await client.put<UserDoc>("/distributions/devto", {
      body: input,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    return client.put<UserDoc>("/distributions/devto", {
      body: input,
    });
  }
}

export async function revokeDevtoDistribution(client: ApiClient = apiClient): Promise<UserDoc> {
  try {
    return await client.delete<UserDoc>("/distributions/devto");
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    return client.delete<UserDoc>("/distributions/devto");
  }
}

export async function publishDevtoDistribution(
  input: DistributionPublishInput,
  client: ApiClient = apiClient,
): Promise<DistributionPublishResult> {
  try {
    return await client.post<DistributionPublishResult>("/distributions/devto/publish", {
      body: input,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
    return client.post<DistributionPublishResult>("/distributions/devto/publish", {
      body: input,
    });
  }
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Not Found");
}
