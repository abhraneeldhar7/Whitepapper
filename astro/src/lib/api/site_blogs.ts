import { apiClient } from "@/lib/api/client";
import type { CollectionDoc, PaperDoc } from "@/lib/types";




export type SiteBlogCollectionResponse = {
  collection: CollectionDoc;
  papers: PaperDoc[];
};

export type SiteBlogPaperResponse = {
  paper: PaperDoc;
};

export async function getSiteBlogCollectionBySlug(
  slug: string,
): Promise<SiteBlogCollectionResponse> {
  return apiClient.get<SiteBlogCollectionResponse>("/site-blogs/collection", {
    auth: "none",
    query: { slug },
  });
}

export async function getSiteBlogPaperBySlug(
  slug: string,
): Promise<SiteBlogPaperResponse> {
  return apiClient.get<SiteBlogPaperResponse>("/site-blogs/paper", {
    auth: "none",
    query: { slug },
  });
}
