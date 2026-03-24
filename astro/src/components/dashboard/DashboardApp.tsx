import { useState, useEffect } from "react";
import { FolderPlus, LockIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import UserPopover from "@/components/pre_made_components/user_popover/userPopover";
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
import { createPaper } from "@/lib/api/papers";
import { createProject } from "@/lib/api/projects";
import type { PaperDoc, ProjectDoc, UserDoc } from "@/lib/types";
import FolderNotes from "../folderComponent";
import EmptyPaperNotes from "../emptyPagesComp";
import PaperCardComponent from "../paperCardComponent";
import ScrollToTop from "../scrollToTop";

type DashboardAppProps = {
  initialProjects: ProjectDoc[];
  initialPages: PaperDoc[];
  initialUser: UserDoc;
};
type DashboardTab = "pages" | "settings";


const dashboardTabs = ["pages", "settings"];

function buildOptimisticProject(ownerId?: string, name?: string, isPublic?: boolean): ProjectDoc {
  const now = new Date().toISOString();
  const nonce = Date.now();
  return {
    projectId: `optimistic-project-${nonce}`,
    ownerId: ownerId || "optimistic-owner",
    name: name?.trim() || "Creating project...",
    slug: `creating-project-${nonce}`,
    description: "",
    isPublic: Boolean(isPublic),
    pagesNumber: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function readTabFromQuery(): DashboardTab {
  if (typeof window === "undefined") {
    return "pages";
  }

  const rawTab = new URLSearchParams(window.location.search).get("tab");
  if (rawTab && dashboardTabs.includes(rawTab as DashboardTab)) {
    return rawTab as DashboardTab;
  }

  return "pages";
}

function writeTabToQuery(tab: DashboardTab): void {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", tab);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.pushState({}, "", url);
}

export default function DashboardApp({ initialProjects, initialPages, initialUser }: DashboardAppProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>(readTabFromQuery);
  const [projects, setProjects] = useState<ProjectDoc[]>(initialProjects);
  const [pages, setPages] = useState<PaperDoc[]>(initialPages);
  const [creatingPage, setCreatingPage] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectPublic, setNewProjectPublic] = useState(true);

  // Sync state with props to get fresh data when navigating back
  useEffect(() => {
    setProjects(initialProjects);
    setPages(initialPages);
  }, [initialProjects, initialPages]);




  async function handleCreatePage() {
    setCreatingPage(true);

    try {
      const createPromise = createPaper({});
      toast.promise(createPromise, {
        loading: "Creating page...",
        success: "Page created.",
        error: "Failed to create page.",
      });
      const paper = await createPromise;
      // setPages((prev) => [optimisticPage, ...prev]);
      window.location.href = `/write/${paper.paperId}`;
    } catch {

    }
    finally {
      setCreatingPage(false)
    }
  }

  async function handleCreateProject() {
    setCreatingProject(true);
    const optimisticProject = buildOptimisticProject(
      initialUser?.userId,
      newProjectName,
      newProjectPublic,
    );
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
      setProjects((prev) => prev.filter((project) => project.projectId !== optimisticProject.projectId));
      setCreatingProject(false);
      toast.error(error instanceof Error ? error.message : "Failed to create project.");
    }
  }


  return (
    <div className="min-h-screen bg-background px-[15px] pt-15 pb-20">
      <ScrollToTop />

      <div className="z-[10] flex p-[10px] justify-end fixed top-0 left-0 w-full">
        <UserPopover user={initialUser} />
      </div>

      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">

        <p className="text-sm text-muted-foreground">Dashboard</p>

        <Tabs value={activeTab} onValueChange={(value) => {
          const nextTab = dashboardTabs.includes(value as DashboardTab)
            ? (value as DashboardTab)
            : "pages";
          setActiveTab(nextTab);
          writeTabToQuery(nextTab);
        }}>
          <TabsList>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="pages" className="mt-10">
            <div className="space-y-8">

              {pages && pages.length === 0 && (
                <div className="flex flex-col items-center">
                  <EmptyPaperNotes height={180} width={180} />
                  <Label>No papers created</Label>
                  <Button loading={creatingPage} onClick={() => { handleCreatePage() }} className="mt-5"><PlusIcon /> Create Paper</Button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-5 md:grid-cols-4">

                {pages && pages.length > 0 &&
                  <div className="flex flex-col items-center select-none cursor-pointer" onClick={() => {
                    if (creatingPage) return;
                    handleCreatePage()
                  }} >
                    <EmptyPaperNotes />
                    <p className="text-sm">Create paper</p>
                  </div>
                }

                {pages.map((page) => (
                  <PaperCardComponent
                    showStatus
                    key={page.paperId}
                    handle={initialUser?.username ?? "user"}
                    paperData={page}
                    onDeleted={(paperId) => setPages((prev) => prev.filter((p) => p.paperId !== paperId))}
                  />
                ))}

              </div>



              <div className="mt-20 space-y-4">
                <p className="text-sm text-muted-foreground">Projects</p>

                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  {projects && projects.length === 0 && (
                    <div className="grid justify-items-center">
                      <FolderNotes height={150} width={150} />
                      <Label>No projects created</Label>
                      <Button
                        className="mt-5"
                        onClick={() => setCreateDialogOpen(true)}
                      >
                        <FolderPlus />
                        Create Project
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                    {projects && projects.length > 0 && (
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          className="border-0 bg-transparent p-0 outline-0"
                          onClick={() => setCreateDialogOpen(true)}
                          aria-label="Create project"
                        >
                          <FolderNotes className="opacity-[0.5] hover:opacity-[1] transition-all duration-400" />
                        </button>
                        <p className="text-sm">Create new project</p>
                      </div>
                    )}

                    {projects.map((project, index) => (
                      <div key={index} className="flex flex-col items-center">
                        <a href={`/dashboard/${project.projectId}`} >
                          <div className="relative inline-flex">
                            <FolderNotes />
                            {project.logoUrl ? (
                              <span className="absolute left-1/2 top-1/2 inline-flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border bg-background">
                                <img
                                  src={project.logoUrl}
                                  alt={project.name}
                                  className="h-full w-full object-cover"
                                />
                              </span>
                            ) : null}
                            {!project.isPublic ? (
                              <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                                <LockIcon size={12} />
                              </span>
                            ) : null}
                          </div>
                        </a>
                        <p className="text-sm ">{project.name}</p>
                        <p className="text-xs mt-2 text-muted-foreground">{project.pagesNumber} pages</p>
                      </div>
                    ))}

                  </div>

                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create Project</DialogTitle>
                      <DialogDescription>
                        Pick a name and choose visibility.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-1">
                      <div className="grid gap-2">
                        <Label htmlFor="project-name">Name</Label>
                        <Input
                          id="project-name"
                          value={newProjectName}
                          onChange={(event) => setNewProjectName(event.target.value)}
                          placeholder="Untitled Project"
                          maxLength={120}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <div>
                          <p className="text-sm font-medium">Public project</p>
                          <p className="text-xs text-muted-foreground">Allow visitors to view this project.</p>
                        </div>
                        <Switch
                          checked={newProjectPublic}
                          onCheckedChange={setNewProjectPublic}
                          aria-label="Toggle public project"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setCreateDialogOpen(false)}
                        disabled={creatingProject}
                      >
                        Cancel
                      </Button>
                      <Button type="button" onClick={handleCreateProject} loading={creatingProject}>
                        Create
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" />
          <TabsContent value="settings" />
        </Tabs>
      </div>
    </div>
  );
}
