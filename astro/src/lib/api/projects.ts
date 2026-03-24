import { apiClient, type ApiClient } from "@/lib/api/client";
import type { ProjectDoc, PaperDoc, CollectionDoc } from "@/lib/types";

type CreateProjectInput = {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
};

type UpdateProjectInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
};

export interface ProjectDashboardData {
  project: ProjectDoc;
  collections: CollectionDoc[];
  papers: PaperDoc[];
}

export async function listProjects(client: ApiClient = apiClient): Promise<ProjectDoc[]> {
  return client.get<ProjectDoc[]>("/projects");
}

export async function getProjectBySlug(
  slug: string,
  client: ApiClient = apiClient,
): Promise<ProjectDoc> {
  return client.get<ProjectDoc>(`/projects/slug/${slug}`);
}

export async function getProjectById(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<ProjectDoc> {
  return client.get<ProjectDoc>(`/projects/${projectId}`);
}

export async function createProject(
  input: CreateProjectInput,
  client: ApiClient = apiClient,
): Promise<ProjectDoc> {
  return client.post<ProjectDoc>("/projects", {
    body: {
      name: input.name,
      description: input.description ?? null,
      isPublic: input.isPublic ?? true,
    },
  });
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  client: ApiClient = apiClient,
): Promise<ProjectDoc> {
  return client.patch<ProjectDoc>(`/projects/${projectId}`, {
    body: input,
  });
}

export async function deleteProject(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<void> {
  await client.delete<{ ok: boolean }>(`/projects/${projectId}`);
}

export async function updateProjectVisibility(
  projectId: string,
  isPublic: boolean,
  client: ApiClient = apiClient,
): Promise<ProjectDoc> {
  return client.patch<ProjectDoc>(`/projects/${projectId}/visibility`, {
    body: { isPublic },
  });
}

export async function checkProjectSlugAvailable(
  slug: string,
  projectId?: string,
  client: ApiClient = apiClient,
): Promise<boolean> {
  const response = await client.get<{ available: boolean }>("/projects/slug/available", {
    query: { slug, projectId },
  });
  return response.available;
}

export async function getProjectDashboardData(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<ProjectDashboardData> {
  return client.get<ProjectDashboardData>(`/projects/${projectId}/dashboard`);
}
