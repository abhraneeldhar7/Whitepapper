import { getDevCollection, getDevPaper } from "./dev";

export async function fetchCollectionBySlug(slug: string, apiKey: string) {
  return getDevCollection(apiKey, "slug", slug);
}

export async function fetchPaperBySlug(slug: string, apiKey: string) {
  return getDevPaper(apiKey, "slug", slug);
}
