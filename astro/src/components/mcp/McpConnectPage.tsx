import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { listProjects } from "@/lib/api/projects";
import { completeMcpOAuthRequest, getMcpOAuthRequest } from "@/lib/api/mcp";
import type { McpOAuthRequestSummary, ProjectDoc } from "@/lib/types";

function getRequestIdFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("request") || "";
}

export default function McpConnectPage() {
  const requestId = useMemo(getRequestIdFromLocation, []);
  const [requestInfo, setRequestInfo] = useState<McpOAuthRequestSummary | null>(null);
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!requestId) {
        toast.error("Missing MCP authorization request.");
        setLoading(false);
        return;
      }

      try {
        const [requestSummary, ownedProjects] = await Promise.all([
          getMcpOAuthRequest(requestId),
          listProjects(),
        ]);
        if (cancelled) {
          return;
        }
        setRequestInfo(requestSummary);
        setProjects(ownedProjects);
        setSelectedProjectId(ownedProjects[0]?.projectId || "");
        setNeedsLogin(false);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to load MCP connection details.";
        if (message.includes("Authentication token is unavailable") || message.includes("Clerk")) {
          setNeedsLogin(true);
        } else {
          toast.error(message);
        }
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
  }, [requestId]);

  async function handleConnect() {
    if (!selectedProjectId) {
      toast.error("Choose a project first.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await completeMcpOAuthRequest(requestId, selectedProjectId);
      window.location.href = response.redirectTo;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete MCP connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="animate-spin" size={16} />
          Preparing MCP connection...
        </div>
      </div>
    );
  }

  if (needsLogin) {
    const redirectUrl = typeof window !== "undefined" ? window.location.href : "/mcp/connect";
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Connect Whitepapper</CardTitle>
            <CardDescription>Sign in first, then come right back to finish connecting your IDE.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <a href={`/login?redirect_url=${encodeURIComponent(redirectUrl)}`}>Log in to Whitepapper</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Connect Whitepapper</CardTitle>
          <CardDescription>
            {requestInfo?.clientName || "Your IDE"} wants access to one Whitepapper project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mcp-project">Project</Label>
            <select
              id="mcp-project"
              className="flex h-[35px] w-full rounded-sm border border-border bg-background px-3 text-sm outline-none"
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              {projects.map((project) => (
                <option key={project.projectId} value={project.projectId}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a project first, then try connecting again.</p>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={handleConnect} loading={submitting} disabled={!selectedProjectId || projects.length === 0}>
              Connect
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
