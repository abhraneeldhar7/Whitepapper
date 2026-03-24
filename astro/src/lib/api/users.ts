import { apiClient, type ApiClient } from "@/lib/api/client";
import type { UserDoc, ProjectDoc, PaperDoc } from "@/lib/types";

export async function getCurrentUser(client: ApiClient = apiClient): Promise<UserDoc> {
  return client.get<UserDoc>("/users/me");
}

export interface DashboardData {
  user: UserDoc;
  projects: ProjectDoc[];
  papers: PaperDoc[];
}

export async function getDashboardData(client: ApiClient = apiClient): Promise<DashboardData> {
  return client.get<DashboardData>("/users/dashboard");
}

export async function updateCurrentUser(
  input: UserDoc,
  client: ApiClient = apiClient,
): Promise<UserDoc> {
  return client.patch<UserDoc>("/users/me", {
    body: input,
  });
}
