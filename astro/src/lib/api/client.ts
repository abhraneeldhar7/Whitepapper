type RequestMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
type QueryPrimitive = string | number | boolean | null | undefined;
type AuthMode = "required" | "optional" | "none";

type ClerkWindow = Window & {
  Clerk?: {
    loaded?: boolean;
    load?: () => Promise<void>;
    session?: {
      getToken?: () => Promise<string | null>;
    };
  };
};

export type QueryParams = Record<
  string,
  QueryPrimitive | QueryPrimitive[]
>;

export type RequestOptions = {
  body?: unknown;
  query?: QueryParams;
  headers?: HeadersInit;
  auth?: AuthMode;
};

export type ApiClient = {
  get: <T>(path: string, options?: RequestOptions) => Promise<T>;
  post: <T>(path: string, options?: RequestOptions) => Promise<T>;
  patch: <T>(path: string, options?: RequestOptions) => Promise<T>;
  put: <T>(path: string, options?: RequestOptions) => Promise<T>;
  delete: <T>(path: string, options?: RequestOptions) => Promise<T>;
};

type ApiRequestOptions = RequestOptions & {
  method?: RequestMethod;
};

type TokenResolver = (auth: AuthMode) => Promise<string | null>;

const PUBLIC_API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL?.trim();
const API_BASE_PATH = "/api/v1";
const MISSING_TOKEN_ERROR = "Authentication token is unavailable.";


function resolveApiBaseUrl(): string {
  if (PUBLIC_API_BASE_URL) {
    return PUBLIC_API_BASE_URL;
  }

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  throw new Error("PUBLIC_API_BASE_URL must be configured for SSR API requests.");
}


function toRequestUrl(path: string, query?: QueryParams): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiBaseUrl = resolveApiBaseUrl();
  const url = new URL(`${API_BASE_PATH}${normalizedPath}`, `${apiBaseUrl}/`);
  if (!query) return url.toString();

  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === null || item === undefined) continue;
      url.searchParams.append(key, String(item));
    }
  }

  return url.toString();
}

async function resolveBrowserToken(_auth: AuthMode): Promise<string | null> {
  if (_auth === "none") {
    return null;
  }

  if (typeof window === "undefined") {
    throw new Error("Browser API client cannot be used for authenticated SSR requests.");
  }

  const clerk = (window as ClerkWindow).Clerk;
  if (!clerk) {
    throw new Error("Clerk is not available in the browser.");
  }

  if (!clerk.loaded) {
    await clerk.load?.();
  }

  if (!clerk.loaded) {
    throw new Error("Clerk failed to initialize.");
  }

  const token = (await clerk.session?.getToken?.()) ?? null;
  if (!token && _auth === "required") {
    throw new Error(MISSING_TOKEN_ERROR);
  }

  return token;
}

function createServerTokenResolver(token: string | null): TokenResolver {
  return async (auth: AuthMode) => {
    if (auth === "none") {
      return null;
    }
    if (!token && auth === "required") {
      throw new Error(MISSING_TOKEN_ERROR);
    }
    return token;
  };
}

function createRequestClient(resolveToken: TokenResolver): ApiClient {
  async function apiRequest<T>(
    path: string,
    {
      method = "GET",
      body,
      query,
      headers,
      auth = "required",
    }: ApiRequestOptions = {},
  ): Promise<T> {
    let resolvedToken: string | null = null;
    if (auth !== "none") {
      if (auth === "optional") {
        try {
          resolvedToken = await resolveToken(auth);
        } catch {
          resolvedToken = null;
        }
      } else {
        resolvedToken = await resolveToken(auth);
      }
    }

    const requestHeaders = new Headers(headers);
    requestHeaders.set("accept", "application/json");

    let requestBody: BodyInit | undefined;
    if (body instanceof FormData) {
      requestBody = body;
      requestHeaders.delete("content-type");
    } else if (
      body !== undefined &&
      body !== null &&
      !(body instanceof Blob) &&
      !(body instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(body) &&
      !(typeof body === "string")
    ) {
      requestBody = JSON.stringify(body);
      requestHeaders.set("content-type", "application/json");
    } else if (body !== undefined && body !== null) {
      requestBody = body as BodyInit;
    }

    if (resolvedToken) {
      requestHeaders.set("authorization", `Bearer ${resolvedToken}`);
    } else {
      requestHeaders.delete("authorization");
    }

    const response = await fetch(toRequestUrl(path, query), {
      method,
      headers: requestHeaders,
      body: requestBody,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed with ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return (await response.text()) as T;
    }

    return response.json() as Promise<T>;
  }

  return {
    get: <T>(path: string, options?: RequestOptions) =>
      apiRequest<T>(path, { method: "GET", ...options }),
    post: <T>(path: string, options?: RequestOptions) =>
      apiRequest<T>(path, { method: "POST", ...options }),
    patch: <T>(path: string, options?: RequestOptions) =>
      apiRequest<T>(path, { method: "PATCH", ...options }),
    put: <T>(path: string, options?: RequestOptions) =>
      apiRequest<T>(path, { method: "PUT", ...options }),
    delete: <T>(path: string, options?: RequestOptions) =>
      apiRequest<T>(path, { method: "DELETE", ...options }),
  };
}

export function createApiClient(token: string | null): ApiClient {
  return createRequestClient(createServerTokenResolver(token));
}

export const apiClient: ApiClient = createRequestClient(resolveBrowserToken);
