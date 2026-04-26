import { apiClient, type ApiClient } from "@/lib/api/client";
import { MAX_DESCRIPTION_LENGTH } from "@/lib/limits";
import { sortPapersLatestFirst } from "@/lib/paperSort";
import type { ProjectDoc, PaperDoc, CollectionDoc } from "@/lib/entities";

type CreateProjectInput = {
  name?: string;
  description?: string | null;
  contentGuidelines?: string | null;
  isPublic?: boolean;
};

type UpdateProjectInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  contentGuidelines?: string | null;
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
  username: string,
  slug: string,
  client: ApiClient = apiClient,
): Promise<ProjectDoc> {
  return client.get<ProjectDoc>(`/projects/slug/${username}/${slug}`);
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
  const description = input.description ?? null;
  const contentGuidelines = input.contentGuidelines ?? null;
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Project description is too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
  }
  if (contentGuidelines && contentGuidelines.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Project content guidelines are too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  return client.post<ProjectDoc>("/projects", {
    body: {
      name: input.name,
      description,
      contentGuidelines,
      isPublic: input.isPublic ?? true,
    },
  });
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectInput,
  client: ApiClient = apiClient,
): Promise<ProjectDoc> {
  const description = input.description ?? undefined;
  const contentGuidelines = input.contentGuidelines ?? undefined;
  if (typeof description === "string" && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Project description is too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
  }
  if (typeof contentGuidelines === "string" && contentGuidelines.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error(`Project content guidelines are too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  return client.patch<ProjectDoc>(`/projects/${projectId}`, {
    body: {
      ...input,
      description,
      contentGuidelines,
    },
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
  const data = await client.get<ProjectDashboardData>(`/projects/${projectId}/dashboard`);
  return {
    ...data,
    papers: sortPapersLatestFirst(data.papers || []),
  };
}
