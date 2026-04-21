import { apiClient, type ApiClient } from "@/lib/api/client";
import type { McpAuthorizationListResponse, McpConnectionInfo, McpConsentContext } from "@/lib/types";

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
  txnId: string,
  client: ApiClient = apiClient,
): Promise<McpConsentContext> {
  return client.get<McpConsentContext>(`${MCP_API_PREFIX}/consent/context`, {
    query: { txn_id: txnId },
  });
}

export async function submitMcpConsentDecision(
  txnId: string,
  action: "approve" | "deny",
  client: ApiClient = apiClient,
): Promise<{ redirectTo: string; clientId: string; clientName?: string | null }> {
  return client.post<{ redirectTo: string; clientId: string; clientName?: string | null }>(
    `${MCP_API_PREFIX}/consent/decision`,
    {
      body: { txnId, action },
    },
  );
}
