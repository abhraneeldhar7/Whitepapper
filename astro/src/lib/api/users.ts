import { apiClient, type ApiClient } from "@/lib/api/client";
import { sortPapersLatestFirst } from "@/lib/paperSort";
import type { UserDoc, ProjectDoc, PaperDoc } from "@/lib/entities";

export async function getCurrentUser(client: ApiClient = apiClient): Promise<UserDoc> {
  return client.get<UserDoc>("/users/me");
}

export interface DashboardData {
  user: UserDoc;
  projects: ProjectDoc[];
  papers: PaperDoc[];
}

export async function getDashboardData(client: ApiClient = apiClient): Promise<DashboardData> {
  const data = await client.get<DashboardData>("/users/dashboard");
  return {
    ...data,
    papers: sortPapersLatestFirst(data.papers || []),
  };
}

export async function updateCurrentUser(
  input: UserUpdateInput,
  client: ApiClient = apiClient,
): Promise<UserDoc> {
  return client.patch<UserDoc>("/users/me", {
    body: input,
  });
}

export type UserUpdateInput = {
  displayName?: string | null;
  avatarUrl?: string | null;
  username?: string;
  description?: string;
  preferences?: UserDoc["preferences"];
};
