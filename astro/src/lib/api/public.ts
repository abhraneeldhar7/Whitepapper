import { apiClient, type ApiClient } from "@/lib/api/client";
import type {
  CollectionDoc,
  PaperDoc,
  ProjectDoc,
  UserDoc,
} from "@/lib/entities";

export type PublicPaperPagePayload = {
  paper: PaperDoc;
};

export type PublicProfileResponse = {
  user: UserDoc;
  projects: ProjectDoc[];
  papers: PaperDoc[];
};

export type PublicProjectResponse = {
  user: UserDoc;
  project: ProjectDoc;
  collections: CollectionDoc[];
  papers: PaperDoc[];
};

export async function getPublicProfile(handle: string, client: ApiClient = apiClient): Promise<PublicProfileResponse> {
  return client.get<PublicProfileResponse>(`/public/${handle}`, { auth: "none" });
}

export async function getPublicProjectBySlug(
  handle: string,
  projectSlug: string,
  client: ApiClient = apiClient,
): Promise<PublicProjectResponse> {
  return client.get<PublicProjectResponse>(`/public/${handle}/projects/${projectSlug}`, { auth: "none" });
}


export async function getPublicPaperPageData(
  handle: string,
  slug: string,
  client: ApiClient = apiClient,
): Promise<PublicPaperPagePayload> {
  return client.get<PublicPaperPagePayload>(`/public/${handle}/papers/${slug}`, { auth: "none" });
}
