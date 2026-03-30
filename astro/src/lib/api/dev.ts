import { apiClient, type ApiClient } from "@/lib/api/client";
import type { CollectionDoc, PaperDoc, ProjectDoc } from "@/lib/types";

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

export async function getDevProject(
  apiKey: string,
  client: ApiClient = apiClient,
): Promise<DevProjectResponse> {
  return client.get<DevProjectResponse>("/dev/project", {
    auth: "none",
    headers: buildDevHeaders(apiKey),
  });
}

export async function getDevCollection(
  apiKey: string,
  identifierType: IdentifierType,
  identifier: string,
  client: ApiClient = apiClient,
): Promise<DevCollectionResponse> {
  return client.get<DevCollectionResponse>("/dev/collection", {
    auth: "none",
    headers: buildDevHeaders(apiKey),
    query: identifierType === "id" ? { id: identifier } : { slug: identifier },
  });
}

export async function getDevPaper(
  apiKey: string,
  identifierType: IdentifierType,
  identifier: string,
  client: ApiClient = apiClient,
): Promise<DevPaperResponse> {
  return client.get<DevPaperResponse>("/dev/paper", {
    auth: "none",
    headers: buildDevHeaders(apiKey),
    query: identifierType === "id" ? { id: identifier } : { slug: identifier },
  });
}

