import type { CollectionDoc, PaperDoc, ProjectDoc } from "@/lib/entities";

type DevEntity<T> = Omit<T, "ownerId"> & {
  ownerId: null;
};

type IdentifierType = "id" | "slug";

export type DevProjectResponse = {
  project: DevEntity<ProjectDoc>;
  collections: DevEntity<CollectionDoc>[];
};

export type DevCollectionResponse = {
  collection: DevEntity<CollectionDoc>;
  papers: DevEntity<PaperDoc>[];
};

export type DevPaperResponse = {
  paper: DevEntity<PaperDoc>;
};

function buildDevHeaders(apiKey: string): HeadersInit {
  return {
    "x-api-key": apiKey,
    "content-type": "application/json",
  };
}

const DEV_API_BASE_URL = `${import.meta.env.PUBLIC_API_BASE_URL}/dev`;

async function devGet<T>(
  path: string,
  apiKey: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${DEV_API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: buildDevHeaders(apiKey),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getDevProject(
  apiKey: string,
): Promise<DevProjectResponse> {
  return devGet<DevProjectResponse>("/project", apiKey);
}

export async function getDevCollection(
  apiKey: string,
  identifierType: IdentifierType,
  identifier: string,
): Promise<DevCollectionResponse> {
  return devGet<DevCollectionResponse>("/collection", apiKey, identifierType === "id" ? { id: identifier } : { slug: identifier });
}

export async function getDevPaper(
  apiKey: string,
  identifierType: IdentifierType,
  identifier: string,
): Promise<DevPaperResponse> {
  return devGet<DevPaperResponse>("/paper", apiKey, identifierType === "id" ? { id: identifier } : { slug: identifier });
}
