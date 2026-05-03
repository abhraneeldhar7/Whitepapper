import { useState, useEffect, useRef } from "react";
import { FolderPlus, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { UserProvider, useUser } from "@/components/providers/UserProvider";
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
import { createPaper, listOwnedPapers, listStandalonePapers } from "@/lib/api/papers";
import { createProject, listProjects } from "@/lib/api/projects";
import {
  listMcpAuthorizations,
  revokeMcpAuthorization,
} from "@/lib/api/mcp";
import type { McpAuthorizationSummary } from "@/lib/api/mcp";
import { MAX_PAPERS_PER_USER, MAX_PROJECTS_PER_USER } from "@/lib/limits";
import { sortPapersLatestFirst } from "@/lib/paperSort";
import type { PaperDoc, ProjectDoc } from "@/lib/entities";
import { formatFirestoreDate } from "@/lib/utils";
import FolderNotes from "../folderComponent";
import EmptyPaperNotes from "../emptyPagesComp";
import PaperCardComponent from "../paperCardComponent";
import PaperPreviewSheet from "../paperPreviewSheet";
import ScrollToTop from "../scrollToTop";
import ProjectCard from "../project/ProjectCard";
import { Progress } from "../ui/progress";
import PostRender from "@/components/ui/markdown-render/markdown-render";
import { readTabFromQuery, writeTabToQuery } from "@/lib/queryTab";
import { MAX_CONTENT_PAPER_WIDTH, MAX_LANDING_PAGE_WIDTH } from "@/lib/design";

import chatgptLogo from "@/assets/logos/chatgpt.svg"
import openCodeLogo from "@/assets/logos/opencode.svg"
import copilotLogo from "@/assets/logos/githubcopilot.svg"
import codexLogo from "@/assets/logos/codex.svg"

type DashboardAppProps = {};
type DashboardTab = "overview" | "mcp";
const dashboardTabs: DashboardTab[] = ["overview", "mcp"];

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

function buildMcpData() {
  const base = (import.meta.env.PUBLIC_API_BASE_URL as string)?.trim().replace(/\/+$/, "")
    || (typeof window !== "undefined" ? window.location.origin.replace(/\/+$/, "") : "");
  if (!base) return { url: "", config: "" };
  const url = `${base}/mcp`;
  const config = JSON.stringify({
    servers: { whitepapper: { url, type: "http" } },
    inputs: [],
  }, null, 2);
  return { url, config };
}

const SKELETON_AGENTS = [
  { name: "ChatGPT", logo: chatgptLogo },
  { name: "GitHub Copilot", logo: copilotLogo },
  { name: "OpenCode", logo: openCodeLogo },
  { name: "Codex", logo: codexLogo },
];

export default function DashboardApp(props: DashboardAppProps) {
  return (
    <UserProvider>
      <DashboardInner {...props} />
    </UserProvider>
  );
}

function DashboardInner(_props: DashboardAppProps) {
  const { user: currentUser } = useUser();
  const isMobileUA = false;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() =>
    readTabFromQuery<DashboardTab>(dashboardTabs, "overview"),
  );
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [pages, setPages] = useState<PaperDoc[]>([]);
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
  const [mcpLoading, setMcpLoading] = useState(false);
  const mcpFetchedRef = useRef(false);
  const [revokingMcpAuthorizationId, setRevokingMcpAuthorizationId] = useState<string | null>(null);
  const [revokingMcpAuthorization, setRevokingMcpAuthorization] = useState(false);
  const [revokeMcpDialogOpen, setRevokeMcpDialogOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      listProjects(),
      listStandalonePapers(),
    ]).then(([p, s]) => {
      setProjects(p);
      setPages(sortPapersLatestFirst(s));
    }).catch(() => {}).finally(() => {
      setLoading(false);
      const shell = document.getElementById("app-shell");
      if (shell) shell.remove();
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "mcp" || mcpFetchedRef.current) return;
    setMcpLoading(true);
    mcpFetchedRef.current = true;
    listMcpAuthorizations().then((authResp) => {
      setMcpAuthorizations(authResp.authorizations);
      setMcpUsage(authResp.usage);
      setMcpLimitPerMonth(authResp.limitPerMonth);
    }).catch(() => { }).finally(() => {
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
      toast.error(error instanceof Error ? error.message : "Failed to create project.");
    } finally {
      setCreatingProject(false);
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

  const handle = currentUser?.username;
  const mcpData = buildMcpData();
  const mcpProgress = mcpLimitPerMonth > 0
    ? Math.min(100, Math.max(0, (mcpUsage / mcpLimitPerMonth) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-background px-5 md:px-15 pt-20">
      <ScrollToTop />

      <div className="z-[10] top-5 right-5 fixed">
        <UserPopover />
      </div>

      <div className="mx-auto flex w-full flex-col gap-5"
        style={{ maxWidth: `${MAX_LANDING_PAGE_WIDTH}px` }}
      >
        <p className="text-sm text-muted-foreground">Dashboard</p>

        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as DashboardTab); writeTabToQuery(value); }}>
          <TabsList className="sticky top-5 z-[10]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-10">
            <div className="space-y-8">
              {!loading && pages.length === 0 && (
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
                    handle={handle}
                    paperData={page}
                    onSelect={(paper) => { setSelectedPaper(paper); setPreviewOpen(true); }}
                  />
                ))}
              </div>

              <div className="mt-20 space-y-4">
                <p className="text-sm text-muted-foreground">Projects</p>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  {!loading && projects.length === 0 && (
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
              handle={handle}
              isMobileUA={isMobileUA}
              onPaperDeleted={handlePaperDeleted}
            />
          </TabsContent>

          <TabsContent value="mcp" className="mt-5">
            <div className="space-y-10 w-full mx-auto mt-10" style={{ maxWidth: MAX_CONTENT_PAPER_WIDTH }}>

              {mcpData.url && (
                <div className="space-y-4">
                  <Label>MCP URL</Label>
                  <PostRender content={`~~~${mcpData.url.split(":").slice(0, 1).join("")}\n${mcpData.url}\n~~~`} />
                </div>
              )}


              <div className="space-y-4">
                <div className="flex justify-between">
                  <Label>Monthly usage</Label>
                  {mcpLoading ? (
                    <Skeleton className="h-[14px] w-16" />
                  ) : (
                    <p className="font-[450] text-[12px]">{mcpUsage} / {mcpLimitPerMonth}</p>
                  )}
                </div>
                <Progress className="w-full" value={mcpLoading ? 0 : mcpProgress} />
                <p className="text-[14px] text-center text-muted-foreground">Limits reset at beginning of every month</p>
              </div>


              <div className="space-y-4">
                <Label>Active connections</Label>
                {mcpLoading ? (
                  <div className="space-y-4">
                    {SKELETON_AGENTS.map((item, i) => (
                      <div key={i} className="flex gap-4 items-center animate-pulse" style={{ animationDelay: `${i * 150}ms` }}>
                        <div className="shrink-0 pt-1">
                          <img src={item.logo.src} className="w-[27px] h-[27px] dark:invert" />
                        </div>

                        <div className="flex-1">
                          <Skeleton className="h-[15px] w-[140px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : mcpAuthorizations.length === 0 ? (
                  <div className="space-y-5 mt-10">
                    <div className="grid md:grid-cols-4 grid-cols-2 gap-5">
                      {SKELETON_AGENTS.map((item, index) => (
                        <a href={index == 0 ? "/docs/mcp/chatgpt" : index == 1 ? "/docs/mcp/copilot" : index == 2 ? "/docs/mcp/opencode" : "/docs/mcp/codex"} target="_blank" className="flex flex-col flex-1 items-center justify-start gap-4 transition-all duration-300 hover:bg-muted py-6">
                          <img src={item.logo.src} className="w-[32px] h-[32px] dark:invert" />
                          <p className="text-center">{item.name}</p>
                        </a>
                      ))}
                    </div>
                    <p className="text-[14px] text-center ">No active MCP connections, read the guide to connect your agents.</p>
                  </div>
                ) : (
                  <div className="space-y-6 mt-5">
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
                      )
                    })}
                    <div className="flex pt-4 justify-center w-full">
                      <a target="_blank" href="/docs/mcp/quickstart" className="underline text-[14px] text-center text-muted-foreground">How to connect my agents?</a>
                    </div>
                  </div>
                )}
              </div>







              <Dialog open={revokeMcpDialogOpen} onOpenChange={setRevokeMcpDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Revoke MCP connection?</DialogTitle>
                    <DialogDescription>This will invalidate the selected IDE connection.</DialogDescription>
                  </DialogHeader>
                  {(() => {
                    const item = mcpAuthorizations.find((a) => a.authorizationId === revokingMcpAuthorizationId);
                    const agentLogo = item ? getAgentLogo(item.agentName ?? "") : null;
                    return item ? (
                      <div className="flex gap-4 my-2">
                        <div className="shrink-0 pt-1">
                          {agentLogo && <img src={agentLogo} className="w-[27px] h-[27px] dark:invert" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-[16px] truncate">{item.agentName}</p>
                          <p className="text-[12px] text-muted-foreground">{formatFirestoreDate(item.createdAt)}</p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  <DialogFooter>
                    <Button variant="secondary" onClick={() => { setRevokeMcpDialogOpen(false); setRevokingMcpAuthorizationId(null); }}>Cancel</Button>
                    <Button variant="destructive" loading={revokingMcpAuthorization} onClick={handleRevokeMcpAuthorization}>Revoke</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
