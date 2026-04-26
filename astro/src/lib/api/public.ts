import { apiClient } from "@/lib/api/client";
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

export async function getPublicProfile(handle: string): Promise<PublicProfileResponse> {
  return apiClient.get<PublicProfileResponse>(`/public/${handle}`, { auth: "none" });
}

export async function getPublicProjectBySlug(
  handle: string,
  projectSlug: string,
): Promise<PublicProjectResponse> {
  return apiClient.get<PublicProjectResponse>(`/public/${handle}/projects/${projectSlug}`, { auth: "none" });
}


export async function getPublicPaperPageData(
  handle: string,
  slug: string,
): Promise<PublicPaperPagePayload> {
  return apiClient.get<PublicPaperPagePayload>(`/public/${handle}/papers/${slug}`, { auth: "none" });
}
