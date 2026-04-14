import { apiClient, type ApiClient } from "@/lib/api/client";
import type { McpConnectionInfo, McpOAuthRequestSummary, McpTokenSummary } from "@/lib/types";

const MCP_API_PREFIX = "/mcp";

export async function listProjectMcpTokens(
  projectId: string,
  client: ApiClient = apiClient,
): Promise<McpTokenSummary[]> {
  return client.get<McpTokenSummary[]>(`/projects/${projectId}/mcp-tokens`);
}

export async function getMcpConnectionInfo(
  client: ApiClient = apiClient,
): Promise<McpConnectionInfo> {
  return client.get<McpConnectionInfo>(`${MCP_API_PREFIX}/config`, { auth: "none" });
}

export async function revokeProjectMcpToken(
  projectId: string,
  tokenId: string,
  client: ApiClient = apiClient,
): Promise<void> {
  await client.delete<{ ok: boolean }>(`/projects/${projectId}/mcp-tokens/${tokenId}`);
}

export async function getMcpOAuthRequest(
  requestId: string,
  client: ApiClient = apiClient,
): Promise<McpOAuthRequestSummary> {
  return client.get<McpOAuthRequestSummary>(`${MCP_API_PREFIX}/oauth/request/${requestId}`, { auth: "none" });
}

export async function completeMcpOAuthRequest(
  requestId: string,
  projectId: string,
  client: ApiClient = apiClient,
): Promise<{ redirectTo: string }> {
  return client.post<{ redirectTo: string }>(`${MCP_API_PREFIX}/oauth/complete`, {
    body: { requestId, projectId },
  });
}
