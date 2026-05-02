import { apiClient, type ApiClient } from "@/lib/api/client";

export type McpAuthorizationSummary = {
  authorizationId: string;
  agentName?: string | null;
  createdAt: string;
};

export type McpAuthorizationListResponse = {
  authorizations: McpAuthorizationSummary[];
  usage: number;
  limitPerMonth: number;
};

export type McpConsentContext = {
  requestId: string;
  clientId: string;
  clientName?: string | null;
  redirectUri: string;
  scopes: string[];
  user: {
    displayName?: string | null;
    username?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  };
};

export type McpConnectionInfo = {
  serverName: string;
  transport: "http";
  endpointUrl: string;
  manualConfig: {
    servers: Record<
      string,
      {
        url: string;
        type: "http";
      }
    >;
    inputs: unknown[];
  };
};

const MCP_API_PREFIX = "/mcp";

export async function listMcpAuthorizations(
  client: ApiClient = apiClient,
): Promise<McpAuthorizationListResponse> {
  return client.get<McpAuthorizationListResponse>(`${MCP_API_PREFIX}/authorizations`);
}

export async function getMcpConnectionInfo(
  client: ApiClient = apiClient,
): Promise<McpConnectionInfo> {
  return client.get<McpConnectionInfo>(`${MCP_API_PREFIX}/config`, { auth: "none" });
}

export async function revokeMcpAuthorization(
  authorizationId: string,
  client: ApiClient = apiClient,
): Promise<void> {
  await client.delete<{ ok: boolean }>(`${MCP_API_PREFIX}/authorizations/${authorizationId}`);
}

export async function getMcpConsentContext(
  requestId: string,
  client: ApiClient = apiClient,
): Promise<McpConsentContext> {
  return client.get<McpConsentContext>(`/oauth/consent/context`, {
    query: { requestId },
  });
}

export async function submitMcpConsentDecision(
  requestId: string,
  action: "approve" | "deny",
  client: ApiClient = apiClient,
): Promise<{ redirectTo: string }> {
  return client.post<{ redirectTo: string }>(
    `/oauth/consent/complete`,
    {
      body: { requestId, action },
    },
  );
}
