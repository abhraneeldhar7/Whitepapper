import type { CollectionDoc, PaperDoc } from "@/lib/entities";

export type SitePaperResponse = {
  paper: PaperDoc;
};

export type SiteCollectionResponse = {
  collection: CollectionDoc;
  papers: PaperDoc[];
};

function resolveDevEnv() {
  const apiBaseUrl = String(import.meta.env.PUBLIC_API_BASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const apiKey = String(import.meta.env.WHITEPAPPER_API_KEY ?? "").trim();

  if (!apiBaseUrl || !apiKey) {
    throw new Error(
      "PUBLIC_API_BASE_URL and WHITEPAPPER_API_KEY must be configured in Astro env.",
    );
  }

  return { apiBaseUrl, apiKey };
}

async function devGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const { apiBaseUrl, apiKey } = resolveDevEnv();
  const url = new URL(`${apiBaseUrl}/dev/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Upstream request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchDevPaperBySlug(slug: string): Promise<SitePaperResponse> {
  return devGet<SitePaperResponse>("paper", { slug });
}

export async function fetchDevCollectionBySlug(slug: string): Promise<SiteCollectionResponse> {
  return devGet<SiteCollectionResponse>("collection", { slug });
}

export async function fetchDevPaperBySlugRaw(slug: string): Promise<Response> {
  const { apiBaseUrl, apiKey } = resolveDevEnv();
  const url = new URL(`${apiBaseUrl}/dev/paper`);
  url.searchParams.set("slug", slug);

  return fetch(url.toString(), {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
  });
}
