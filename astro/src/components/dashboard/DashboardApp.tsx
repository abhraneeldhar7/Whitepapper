import { useState, useEffect, useRef } from "react";
import { FolderPlus, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import UserPopover from "@/components/userPopover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { createPaper, listOwnedPapers } from "@/lib/api/papers";
import { createProject } from "@/lib/api/projects";
import {
  getMcpConnectionInfo,
  listMcpAuthorizations,
  revokeMcpAuthorization,
} from "@/lib/api/mcp";
import type { McpAuthorizationSummary, McpConnectionInfo } from "@/lib/api/mcp";
import { MAX_PAPERS_PER_USER, MAX_PROJECTS_PER_USER } from "@/lib/limits";
import { sortPapersLatestFirst } from "@/lib/paperSort";
import type { PaperDoc, ProjectDoc, UserDoc } from "@/lib/entities";
import { formatFirestoreDate } from "@/lib/utils";
import FolderNotes from "../folderComponent";
import EmptyPaperNotes from "../emptyPagesComp";
import PaperCardComponent from "../paperCardComponent";
import PaperPreviewSheet from "../paperPreviewSheet";
import ScrollToTop from "../scrollToTop";
import ProjectCard from "../project/ProjectCard";
import { Progress } from "../ui/progress";
import PostRender from "@/components/ui/markdown-render/markdown-render";
import { MAX_CONTENT_PAPER_WIDTH } from "@/lib/design";

import chatgptLogo from "@/assets/logos/chatgpt.svg"
import openCodeLogo from "@/assets/logos/opencode.svg"
import copilotLogo from "@/assets/logos/githubcopilot.svg"
import codexLogo from "@/assets/logos/codex.svg"

type DashboardAppProps = {
  initialProjects: ProjectDoc[];
  initialPages: PaperDoc[];
  initialUser: UserDoc;
  isMobileUA: boolean;
};
type DashboardTab = "overview" | "mcp";

function buildOptimisticProject(ownerId?: string, name?: string, isPublic?: boolean): ProjectDoc {
  const now = new Date().toISOString();
  const nonce = Date.now();
  return {
    projectId: `optimistic-project-${nonce}`,
    ownerId: ownerId || "optimistic-owner",
    name: name?.trim() || "Creating project...",
    slug: `creating-project-${nonce}`,
    description: "",
    contentGuidelines: "",
    isPublic: Boolean(isPublic),
    pagesNumber: 0,
    createdAt: now,
    updatedAt: now,
  };
}

const AGENT_LOGOS: Record<string, string> = {
  chatgpt: chatgptLogo.src,
  visualstudiocode: copilotLogo.src,
  opencode: openCodeLogo.src,
  codex: codexLogo.src,
};

function getAgentLogo(agentName: string): string | null {
  const key = agentName.toLowerCase().replace(/\s+/g, "");
  for (const [match, logo] of Object.entries(AGENT_LOGOS)) {
    if (key.includes(match)) return logo;
  }
  return null;
}

function buildMcpUrl(): string {
  const base = (import.meta.env.PUBLIC_API_BASE_URL as string)?.trim().replace(/\/+$/, "")
    || (typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "");
  return base ? `${base}/mcp` : "";
}

export default function DashboardApp({ initialProjects, initialPages, initialUser, isMobileUA }: DashboardAppProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [projects, setProjects] = useState<ProjectDoc[]>(initialProjects);
  const [pages, setPages] = useState<PaperDoc[]>(() => sortPapersLatestFirst(initialPages));
  const [creatingPage, setCreatingPage] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<PaperDoc | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPublic, setNewProjectPublic] = useState(true);

  const [mcpAuthorizations, setMcpAuthorizations] = useState<McpAuthorizationSummary[]>([]);
  const [mcpUsage, setMcpUsage] = useState(0);
  const [mcpLimitPerMonth, setMcpLimitPerMonth] = useState(0);
  const [mcpConnectionInfo, setMcpConnectionInfo] = useState<McpConnectionInfo | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);
  const mcpFetchedRef = useRef(false);
  const [revokingMcpAuthorizationId, setRevokingMcpAuthorizationId] = useState<string | null>(null);
  const [revokingMcpAuthorization, setRevokingMcpAuthorization] = useState(false);
  const [revokeMcpDialogOpen, setRevokeMcpDialogOpen] = useState(false);

  useEffect(() => {
    if (activeTab !== "mcp" || mcpFetchedRef.current) return;
    setMcpLoading(true);
    mcpFetchedRef.current = true;
    Promise.all([
      listMcpAuthorizations(),
      getMcpConnectionInfo().catch(() => null),
    ]).then(([authResp, connInfo]) => {
      setMcpAuthorizations(authResp.authorizations);
      setMcpUsage(authResp.usage);
      setMcpLimitPerMonth(authResp.limitPerMonth);
      setMcpConnectionInfo(connInfo);
    }).catch(() => {
      // MCP data is non-critical
    }).finally(() => {
      setMcpLoading(false);
    });
  }, [activeTab]);

  async function handleCreatePage() {
    setCreatingPage(true);
    try {
      const ownedPapers = await listOwnedPapers();
      if (ownedPapers.length >= MAX_PAPERS_PER_USER) {
        toast.error(`Paper limit reached (${MAX_PAPERS_PER_USER}) for this user. Delete an existing paper to create a new one.`);
        return;
      }
      const createPromise = createPaper({});
      toast.promise(createPromise, {
        loading: "Creating page...",
        success: "Page created.",
        error: "Failed to create page.",
      });
      const paper = await createPromise;
      window.location.href = `/write/${paper.paperId}`;
    } catch {
      // handled by toast
    } finally {
      setCreatingPage(false);
    }
  }

  async function handleCreateProject() {
    if (projects.length >= MAX_PROJECTS_PER_USER) {
      toast.error(`Project limit reached (${MAX_PROJECTS_PER_USER}). Delete an existing project to create a new one.`);
      return;
    }
    setCreatingProject(true);
    const optimisticProject = buildOptimisticProject(initialUser?.userId, newProjectName, newProjectPublic);
    setProjects((prev) => [optimisticProject, ...prev]);
    try {
      const project = await createProject({
        name: newProjectName.trim() || undefined,
        description: null,
        isPublic: newProjectPublic,
      });
      setCreateDialogOpen(false);
      setNewProjectName("");
      setNewProjectPublic(true);
      window.location.href = `/dashboard/${project.projectId}`;
    } catch (error) {
      setProjects((prev) => prev.filter((p) => p.projectId !== optimisticProject.projectId));
      setCreatingProject(false);
      toast.error(error instanceof Error ? error.message : "Failed to create project.");
    }
  }

  function handlePaperDeleted(paperId: string) {
    setPages((prev) => prev.filter((paper) => paper.paperId !== paperId));
    setSelectedPaper((prev) => (prev?.paperId === paperId ? null : prev));
    setPreviewOpen(false);
  }

  async function handleRevokeMcpAuthorization() {
    if (!revokingMcpAuthorizationId) return;
    setRevokingMcpAuthorization(true);
    try {
      await revokeMcpAuthorization(revokingMcpAuthorizationId);
      setMcpAuthorizations((prev) => prev.filter((a) => a.authorizationId !== revokingMcpAuthorizationId));
      setRevokeMcpDialogOpen(false);
      setRevokingMcpAuthorizationId(null);
      toast.success("MCP connection revoked.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke MCP connection.");
    } finally {
      setRevokingMcpAuthorization(false);
    }
  }

  const resolvedMcpInfo = mcpConnectionInfo;
  const mcpUrl = resolvedMcpInfo?.endpointUrl || buildMcpUrl();
  const mcpManualConfig = resolvedMcpInfo ? JSON.stringify(resolvedMcpInfo.manualConfig, null, 2) : "";
  const setupMarkdown = resolvedMcpInfo
    ? `\`\`\`json\n${mcpManualConfig}\n\`\`\``
    : "";
  const mcpProgress = mcpLimitPerMonth > 0
    ? Math.min(100, Math.max(0, (mcpUsage / mcpLimitPerMonth) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background px-[15px] pt-15 pb-20">
      <ScrollToTop />

      <div className="z-[10] flex p-[10px] justify-end fixed top-0 left-0 w-full">
        <UserPopover user={initialUser} />
      </div>

      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
        <p className="text-sm text-muted-foreground">Dashboard</p>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-10">
            <div className="space-y-8">
              {pages.length === 0 && (
                <div className="flex flex-col items-center">
                  <EmptyPaperNotes height={180} width={180} />
                  <Label>No papers created</Label>
                  <Button loading={creatingPage} onClick={handleCreatePage} className="mt-5"><PlusIcon /> Create Paper</Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                {pages.length > 0 && (
                  <div className="flex flex-col items-center select-none cursor-pointer" onClick={() => { if (!creatingPage) handleCreatePage(); }}>
                    <EmptyPaperNotes />
                    <p className="text-sm">Create paper</p>
                  </div>
                )}
                {pages.map((page) => (
                  <PaperCardComponent
                    showStatus
                    key={page.paperId}
                    handle={initialUser?.username ?? "user"}
                    paperData={page}
                    onSelect={(paper) => { setSelectedPaper(paper); setPreviewOpen(true); }}
                  />
                ))}
              </div>

              <div className="mt-20 space-y-4">
                <p className="text-sm text-muted-foreground">Projects</p>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  {projects.length === 0 && (
                    <div className="grid justify-items-center">
                      <FolderNotes height={150} width={150} />
                      <Label>No projects created</Label>
                      <Button className="mt-5" onClick={() => setCreateDialogOpen(true)}>
                        <FolderPlus /> Create Project
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                    {projects.length > 0 && (
                      <div className="flex flex-col items-center">
                        <button
                          className="border-0 bg-transparent p-0 outline-0"
                          onClick={() => setCreateDialogOpen(true)}
                          aria-label="Create project"
                        >
                          <FolderNotes className="opacity-[0.5] hover:opacity-[1] transition-all duration-400" />
                        </button>
                        <p className="text-sm">Create new project</p>
                      </div>
                    )}
                    {projects.map((project) => (
                      <ProjectCard key={project.projectId} project={project} href={`/dashboard/${project.projectId}`} />
                    ))}
                  </div>

                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Project</DialogTitle>
                      <DialogDescription>Pick a name and choose visibility.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-1">
                      <div className="grid gap-2">
                        <Label htmlFor="project-name">Name</Label>
                        <Input id="project-name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Untitled Project" maxLength={120} />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Public project</p>
                          <p className="text-xs text-muted-foreground">Allow visitors to view this project.</p>
                        </div>
                        <Switch checked={newProjectPublic} onCheckedChange={setNewProjectPublic} aria-label="Toggle public project" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="secondary" onClick={() => setCreateDialogOpen(false)} disabled={creatingProject}>Cancel</Button>
                      <Button onClick={handleCreateProject} loading={creatingProject}>Create</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <PaperPreviewSheet
              open={previewOpen}
              onOpenChange={setPreviewOpen}
              paper={selectedPaper}
              handle={initialUser?.username ?? "user"}
              isMobileUA={isMobileUA}
              onPaperDeleted={handlePaperDeleted}
            />
          </TabsContent>

          <TabsContent value="mcp" className="mt-5">
            {mcpLoading ? (
              <div className="space-y-8 w-full mx-auto mt-10" style={{ maxWidth: MAX_CONTENT_PAPER_WIDTH }}>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-32 w-full" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  {[1, 2].map((i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-10 w-full mx-auto mt-10" style={{ maxWidth: MAX_CONTENT_PAPER_WIDTH }}>
                {mcpUrl && (
                  <div className="space-y-3">
                    <Label>MCP URL</Label>
                    <PostRender content={`~~~url\n${mcpUrl}\n~~~`} />
                  </div>
                )}

                {setupMarkdown && (
                  <div className="space-y-3">
                    <Label>Manual config</Label>
                    <PostRender content={setupMarkdown} />
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Monthly usage</Label>
                    <p className="font-[450] text-[12px]">{mcpUsage} / {mcpLimitPerMonth}</p>
                  </div>
                  <Progress className="w-full" value={mcpProgress} />
                  <p className="text-[14px] text-center text-muted-foreground">Limits reset at beginning of every month</p>
                </div>

                <div className="space-y-4">
                  <Label>Active connections</Label>
                  {mcpAuthorizations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active MCP connections for this account yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {mcpAuthorizations.map((item) => {
                        const agentLogo = getAgentLogo(item.agentName ?? "");
                        return (
                          <div key={item.authorizationId} className="flex gap-4">
                            <div className="shrink-0 pt-1">
                              {agentLogo && <img src={agentLogo} className="w-[27px] h-[27px] dark:invert" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-[16px] truncate">{item.agentName}</p>
                              <p className="text-[12px] text-muted-foreground">{formatFirestoreDate(item.createdAt)}</p>
                            </div>
                            <Button size="sm" variant="destructive" onClick={() => { setRevokingMcpAuthorizationId(item.authorizationId); setRevokeMcpDialogOpen(true); }}>
                              Revoke
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex pt-4 justify-center w-full">
                    <a href="/docs/mcp/quickstart" className="underline text-[14px] text-center text-muted-foreground">How to connect my agents?</a>
                  </div>
                </div>

                <Dialog open={revokeMcpDialogOpen} onOpenChange={setRevokeMcpDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Revoke MCP connection?</DialogTitle>
                      <DialogDescription>This will invalidate the selected IDE connection.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="secondary" onClick={() => { setRevokeMcpDialogOpen(false); setRevokingMcpAuthorizationId(null); }}>Cancel</Button>
                      <Button variant="destructive" loading={revokingMcpAuthorization} onClick={handleRevokeMcpAuthorization}>Revoke</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
