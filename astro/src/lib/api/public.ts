import { apiClient } from "@/lib/api/client";
import type { CollectionDoc, PaperDoc, ProjectDoc, PublicPaperPagePayload, UserDoc } from "@/lib/types";

export type PublicProfileResponse = {
  user: UserDoc;
  projects: ProjectDoc[];
  papers: PaperDoc[];
};

export type PublicCollectionResponse = {
  project: ProjectDoc;
  collection: CollectionDoc;
  papers: PaperDoc[];
};

export type PublicProjectResponse = {
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

export async function getPublicCollectionById(
  handle: string,
  projectSlug: string,
  collectionId: string,
): Promise<PublicCollectionResponse> {
  return apiClient.get<PublicCollectionResponse>(
    `/public/${handle}/projects/${projectSlug}/collections/${collectionId}`,
    { auth: "none" },
  );
}

export async function getPublicPaperPageData(
  handle: string,
  slug: string,
): Promise<PublicPaperPagePayload> {
  return apiClient.get<PublicPaperPagePayload>(`/public/${handle}/papers/${slug}`, { auth: "none" });
}
