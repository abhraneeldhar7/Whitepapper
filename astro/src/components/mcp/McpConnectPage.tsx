import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMcpConsentContext, submitMcpConsentDecision } from "@/lib/api/mcp";
import type { McpConsentContext } from "@/lib/types";

function getTxnIdFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("txn_id") || "";
}

function formatDisplayName(context: McpConsentContext | null): string {
  if (!context) {
    return "Whitepapper user";
  }
  return context.user.displayName || context.user.username || context.user.email || "Whitepapper user";
}

export default function McpConnectPage() {
  const txnId = useMemo(getTxnIdFromLocation, []);
  const [context, setContext] = useState<McpConsentContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!txnId) {
        toast.error("Missing MCP authorization request.");
        setLoading(false);
        return;
      }

      try {
        const nextContext = await getMcpConsentContext(txnId);
        if (cancelled) {
          return;
        }
        setContext(nextContext);
        setNeedsLogin(false);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load MCP consent.";
        if (message.includes("Authentication token is unavailable") || message.includes("Invalid token") || message.includes("Clerk")) {
          setNeedsLogin(true);
          return;
        }
        toast.error(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [txnId]);

  async function handleDecision(action: "approve" | "deny") {
    if (!txnId) {
      return;
    }
    setSubmittingAction(action);
    try {
      const result = await submitMcpConsentDecision(txnId, action);
      window.location.href = result.redirectTo;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete MCP consent.");
      setSubmittingAction(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="animate-spin" size={16} />
          Preparing MCP consent...
        </div>
      </div>
    );
  }

  if (needsLogin) {
    const redirectUrl = typeof window !== "undefined" ? window.location.href : "/mcp/connect";
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>Sign in to Whitepapper</CardTitle>
            <CardDescription>
              Sign in first, then you will come right back here to approve this MCP connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={`/login?redirect_url=${encodeURIComponent(redirectUrl)}`}>Sign in to continue</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>MCP request unavailable</CardTitle>
            <CardDescription>This authorization request expired or could not be loaded.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const displayName = formatDisplayName(context);
  const avatarUrl = context.user.avatarUrl || null;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>{context.clientName || "This agent"} wants to access your Whitepapper account.</CardTitle>
            <CardDescription>
              This MCP connection can read and update content across all projects in your Whitepapper account.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-center gap-4 rounded-lg border p-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt="User avatar" className="h-14 w-14 rounded-full border object-cover" />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-full border bg-muted text-lg font-bold text-foreground">
                  WP
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Signed in as</p>
                <p className="text-base font-semibold">{displayName}</p>
                <p className="text-sm text-muted-foreground">{context.user.email || "No email available"}</p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="grid gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Agent</p>
                  <p className="mt-1 text-sm font-medium">{context.clientName || context.clientId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Client ID</p>
                  <p className="mt-1 break-all text-sm font-medium">{context.clientId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Redirect URI</p>
                  <p className="mt-1 break-all text-sm font-medium">{context.redirectUri}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Scopes</p>
                  <p className="mt-1 text-sm font-medium">
                    {context.scopes.length > 0 ? context.scopes.join(", ") : "No additional scopes"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { void handleDecision("deny"); }}
                loading={submittingAction === "deny"}
                disabled={submittingAction !== null}
              >
                Deny
              </Button>
              <Button
                onClick={() => { void handleDecision("approve"); }}
                loading={submittingAction === "approve"}
                disabled={submittingAction !== null}
              >
                Allow access
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
