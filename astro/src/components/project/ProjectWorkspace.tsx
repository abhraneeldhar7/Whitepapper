import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronRight, CopyIcon, Ellipsis, FolderPlus, LockIcon, NotebookPen, PencilIcon, PlusIcon, Rss, RssIcon, SaveIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import FolderNotes from "@/components/folderComponent";
import TextEditor from "@/components/pre_made_components/editor/textEditor";
import MarkdownRender from "@/components/ui/markdown-render/markdown-render";
import UserPopover from "@/components/userPopover";
import { UserProvider, useUser } from "@/components/providers/UserProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createCollection, listProjectCollections } from "@/lib/api/collections";
import { createApiKey, getProjectApiKey, resetApiKey, setApiKeyActive, type ApiKeySummary } from "@/lib/api/api_keys";
import { createPaper, listOwnedPapers, listProjectPapers } from "@/lib/api/papers";
import {
  checkProjectSlugAvailable,
  deleteProject,
  getProjectById,
  updateProject,
  updateProjectVisibility,
} from "@/lib/api/projects";
import { DEV_API_LIMIT_PER_MONTH, MAX_COLLECTIONS_PER_PROJECT, MAX_DESCRIPTION_LENGTH, MAX_PAPERS_PER_USER } from "@/lib/limits";
import { sortPapersLatestFirst } from "@/lib/paperSort";
import { uploadProjectEmbeddedImage, uploadProjectLogo } from "@/lib/api/uploads";
import { uploadImage } from "@/lib/useImageUpload";
import {
  MAX_EMBEDDED_HEIGHT,
  MAX_EMBEDDED_WIDTH,
  MAX_PROJECT_LOGO_HEIGHT,
  MAX_PROJECT_LOGO_WIDTH,
} from "@/lib/constants";
import type { CollectionDoc, PaperDoc, ProjectDoc, UserDoc } from "@/lib/entities";
import { copyToClipboardWithToast, formatFirestoreDate, normalizeSlug } from "@/lib/utils";
import { readTabFromQuery, writeTabToQuery } from "@/lib/queryTab";
import EmptyPaperNotes from "../emptyPagesComp";
import PaperCardComponent from "../paperCardComponent";
import PaperPreviewSheet from "../paperPreviewSheet";
import ScrollToTop from "../scrollToTop";
import { ApiShowcase } from "../apiShowcase";
import ProjectCard from "./ProjectCard";
import { Progress } from "../ui/progress";
import { MAX_LANDING_PAGE_WIDTH } from "@/lib/design";

type ProjectWorkspaceProps = {
  projectId: string;
};

type ProjectTab = "overview" | "api";

const projectTabs: ProjectTab[] = ["overview", "api"];

export default function ProjectWorkspace(props: ProjectWorkspaceProps) {
  return (
    <UserProvider>
      <ProjectWorkspaceInner {...props} />
    </UserProvider>
  );
}

function ProjectWorkspaceInner({ projectId }: ProjectWorkspaceProps) {
  const { user: currentUser } = useUser();
  const isMobileUA = false;
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProjectTab>(() => readTabFromQuery(projectTabs, "overview"));
  const [project, setProject] = useState<ProjectDoc | null>(null);
  const [draftProject, setDraftProject] = useState<ProjectDoc | null>(null);
  const [pages, setPages] = useState<PaperDoc[]>([]);
  const [collections, setCollections] = useState<CollectionDoc[]>([]);
  const [editingProject, setEditingProject] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<PaperDoc | null>(null);
  const [uploadingProjectLogo, setUploadingProjectLogo] = useState(false);
  const [uploadingProjectEmbeddedCount, setUploadingProjectEmbeddedCount] = useState(0);
  const [tempUploadingProjectLogo, setTempUploadingProjectLogo] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionPublic, setNewCollectionPublic] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [slugCheckMessage, setSlugCheckMessage] = useState<string | null>(null);
  const [updatingProjectVisibility, setUpdatingProjectVisibility] = useState(false);
  const [apiDoc, setApiDoc] = useState<ApiKeySummary | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [creatingApiKey, setCreatingApiKey] = useState(false);
  const [togglingApiKey, setTogglingApiKey] = useState(false);
  const [resettingApiKey, setResettingApiKey] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const projectLogoInputRef = useRef<HTMLInputElement>(null);

  const isProjectAssetUploading = uploadingProjectLogo || uploadingProjectEmbeddedCount > 0;

  useEffect(() => {
    Promise.all([
      getProjectById(projectId),
      listProjectPapers(projectId),
      listProjectCollections(projectId),
    ]).then(([proj, p, c]) => {
      if (proj) setProject(proj);
      setPages(sortPapersLatestFirst(p));
      setCollections(c);
    }).catch(() => {}).finally(() => {
      setLoading(false);
      const shell = document.getElementById("app-shell");
      if (shell) shell.remove();
    });
  }, [projectId]);

  useEffect(() => {
    document.documentElement.dataset.projectWorkspaceReady = "true";
    return () => {
      delete document.documentElement.dataset.projectWorkspaceReady;
      if (tempUploadingProjectLogo) {
        URL.revokeObjectURL(tempUploadingProjectLogo);
      }
    };
  }, [tempUploadingProjectLogo]);

  useEffect(() => {
    setApiKeyCopied(false);
  }, [apiKeyDialogOpen, createdApiKey]);

  useEffect(() => {
    getProjectApiKey(projectId).then((doc) => { setApiDoc(doc); setApiLoading(false); }).catch(() => setApiLoading(false));
  }, [projectId]);

  function beginEditProject() {
    if (!project) return;
    setDraftProject({ ...project });
    setSlugCheckMessage(null);
    setEditingProject(true);
  }

  function cancelEditProject() {
    setDraftProject(null);
    setSlugCheckMessage(null);
    setEditingProject(false);
  }

  async function handleSaveProjectDetails() {
    if (!project || !draftProject) return;
    if (!draftProject.name.trim()) {
      toast.error("Project name cannot be empty.");
      return;
    }

    if ((draftProject.description || "").length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Project description is too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
      return;
    }
    if ((draftProject.contentGuidelines || "").length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Project content guidelines are too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
      return;
    }

    const normalizedSlug = normalizeSlug(draftProject.slug || "");
    if (!normalizedSlug) {
      setSlugCheckMessage("Slug is required.");
      toast.error("Project slug cannot be empty.");
      return;
    }
    if (normalizedSlug.length < 2) {
      setSlugCheckMessage("Slug must be at least 2 characters.");
      toast.error("Project slug must be at least 2 characters.");
      return;
    }

    if (normalizedSlug !== project.slug) {
      try {
        const available = await checkProjectSlugAvailable(normalizedSlug, project.projectId);
        if (!available) {
          setSlugCheckMessage("Slug is already in use.");
          toast.error("Project slug is already in use.");
          return;
        }
      } catch {
        setSlugCheckMessage("Unable to validate slug right now.");
        toast.error("Unable to validate project slug.");
        return;
      }
    }

    setSlugCheckMessage(null);
    setSavingProject(true);
    const savePromise = updateProject(project.projectId, {
      name: draftProject.name.trim(),
      slug: normalizedSlug,
      description: draftProject.description || null,
      contentGuidelines: draftProject.contentGuidelines || null,
      logoUrl: draftProject.logoUrl ?? null,
    });
    toast.promise(savePromise, {
      loading: "Saving project details...",
      success: "Project details updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to save project details."),
    });

    try {
      const updated = await savePromise;
      setProject(updated);
      setDraftProject(null);
      setSlugCheckMessage(null);
      setEditingProject(false);
    } catch {
      // toast.promise handles failure UI.
    } finally {
      setSavingProject(false);
    }
  }

  async function handleProjectVisibilityChange(nextIsPublic: boolean) {
    if (!project || updatingProjectVisibility || project.isPublic === nextIsPublic) {
      return;
    }
    setUpdatingProjectVisibility(true);

    const visibilityPromise = updateProjectVisibility(project.projectId, nextIsPublic);
    toast.promise(visibilityPromise, {
      loading: "Updating project status...",
      success: "Project status updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to update project status."),
    });

    try {
      const updated = await visibilityPromise;
      setProject((prev) => prev ? {
        ...prev,
        isPublic: updated.isPublic,
        updatedAt: updated.updatedAt,
      } : prev);
      setDraftProject((prev) =>
        prev
          ? {
            ...prev,
            isPublic: updated.isPublic,
            updatedAt: updated.updatedAt,
          }
          : prev,
      );
    } catch {
      // toast.promise handles failure UI.
    } finally {
      setUpdatingProjectVisibility(false);
    }
  }

  async function handleProjectLogoUpload(file: File) {
    if (!project) return;

    let localPreview: string | null = null;

    await uploadImage<{ url: string }>(file, {
      compress: { maxWidth: MAX_PROJECT_LOGO_WIDTH, maxHeight: MAX_PROJECT_LOGO_HEIGHT, crop: true },
      upload: (f) => uploadProjectLogo(project.projectId, f),
      onStart: () => setUploadingProjectLogo(true),
      onFinish: () => {
        if (localPreview) URL.revokeObjectURL(localPreview);
        setTempUploadingProjectLogo(null);
        setUploadingProjectLogo(false);
      },
      toastMessages: {
        loading: "Uploading project logo...",
        success: "Project logo uploaded.",
        error: (error) => (error instanceof Error ? error.message : "Project logo upload failed."),
      },
      onPrepare: (uploadableFile) => {
        localPreview = URL.createObjectURL(uploadableFile);
        setTempUploadingProjectLogo(localPreview);
      },
      onSuccess: (uploaded) => {
        if (editingProject) {
          setDraftProject((prev) => (prev ? { ...prev, logoUrl: uploaded.url } : prev));
        } else {
          setDraftProject({ ...project, logoUrl: uploaded.url });
          setSlugCheckMessage(null);
          setEditingProject(true);
        }
      },
    });
  }

  async function onProjectDescriptionImageUpload(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    if (!project) {
      return { success: false, message: "Project is not available." };
    }

    const result = await uploadImage<{ url: string }>(file, {
      compress: { maxWidth: MAX_EMBEDDED_WIDTH, maxHeight: MAX_EMBEDDED_HEIGHT, crop: false },
      upload: (f) => uploadProjectEmbeddedImage(project.projectId, f),
      onStart: () => setUploadingProjectEmbeddedCount((prev) => prev + 1),
      onFinish: () => setUploadingProjectEmbeddedCount((prev) => Math.max(0, prev - 1)),
      toastMessages: {
        loading: "Uploading image...",
        success: "Image uploaded.",
        error: (error) => (error instanceof Error ? error.message : "Image upload failed."),
      },
    });

    if (result) {
      return { success: true, url: result.url };
    }
    return { success: false, message: "Upload failed." };
  }

  async function handleCreatePage() {
    if (!project) return;
    setCreatingPage(true);
    try {
      const ownedPapers = await listOwnedPapers();
      if (ownedPapers.length >= MAX_PAPERS_PER_USER) {
        toast.error(`Paper limit reached (${MAX_PAPERS_PER_USER}) for this user. Delete an existing paper to create a new one.`);
        return;
      }

      const createPromise = createPaper({ projectId: project.projectId });
      toast.promise(createPromise, {
        loading: "Creating page...",
        success: "Page created.",
        error: "Failed to create page.",
      });
      const paper = await createPromise;
      window.location.href = `/write/${paper.paperId}`;
    } catch {
      // toast.promise handles failure UI.
    } finally {
      setCreatingPage(false);
    }
  }

  async function handleCreateCollection() {
    if (!project) return;
    if (collections.length >= MAX_COLLECTIONS_PER_PROJECT) {
      toast.error(`Collection limit reached (${MAX_COLLECTIONS_PER_PROJECT}) for this project.`);
      return;
    }

    setCreatingCollection(true);

    try {
      const createdCollection = await createCollection({
        projectId: project.projectId,
        name: newCollectionName.trim() || "Untitled Collection",
        isPublic: newCollectionPublic,
      });
      setCreateDialogOpen(false);
      setNewCollectionName("");
      setNewCollectionPublic(true);
      window.location.href = `/dashboard/${project.projectId}/${createdCollection.collectionId}`;
    } catch (error) {
      setCreatingCollection(false);
      toast.error(error instanceof Error ? error.message : "Failed to create collection.");
    }
  }

  async function handleDeleteProject() {
    if (!project) return;
    setDeleteLoading(true);
    try {
      await deleteProject(project.projectId);
      window.location.href = "/dashboard";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project.");
      setDeleteLoading(false);
    }
  }

  async function handleCreateApiKey() {
    setCreatingApiKey(true);

    try {
      const response = await createApiKey({ projectId });
      setApiDoc(response);
      setCreatedApiKey(response.rawKey);
      setApiKeyDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create API key.");
    } finally {
      setCreatingApiKey(false);
    }
  }

  async function handleToggleApiKey(nextIsActive: boolean) {
    if (!apiDoc || togglingApiKey || apiDoc.isActive === nextIsActive) {
      return;
    }

    setTogglingApiKey(true);
    try {
      const updated = await setApiKeyActive(apiDoc.keyId, nextIsActive);
      setApiDoc(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update API key status.");
    } finally {
      setTogglingApiKey(false);
    }
  }

  async function handleCopyCreatedApiKey() {
    if (!createdApiKey) {
      return;
    }

    const ok = await copyToClipboardWithToast(createdApiKey, "API key copied.", "Unable to copy API key.");
    if (!ok) {
      setApiKeyCopied(false);
      return;
    }
    setApiKeyCopied(true);
    window.setTimeout(() => setApiKeyCopied(false), 1400);
  }

  async function handleResetApiKey() {
    if (!apiDoc || resettingApiKey) {
      return;
    }

    setResettingApiKey(true);
    try {
      const response = await resetApiKey(apiDoc.keyId);
      setApiDoc(response);
      setCreatedApiKey(response.rawKey);
      setApiKeyDialogOpen(true);
      setResetConfirmOpen(false);
      toast.success("API key reset.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset API key.");
    } finally {
      setResettingApiKey(false);
    }
  }

  function handlePaperDeleted(paperId: string) {
    setPages((prev) => prev.filter((paper) => paper.paperId !== paperId));
    setSelectedPaper((prev) => (prev?.paperId === paperId ? null : prev));
    setPreviewOpen(false);
  }



  if (loading || !project) return null;

  const editableProject = editingProject ? draftProject : project;
  const projectNameForDisplay = editableProject?.name || project.name;
  const projectSlugForDisplay = editableProject?.slug || project.slug;
  const projectDescription = editableProject?.description || "";
  const logoPreview = tempUploadingProjectLogo || editableProject?.logoUrl || "";
  const projectPreviewKey = `${project.projectId}:${project.updatedAt}:${projectDescription.length}`;
  return (
    <div className="min-h-screen bg-background px-5 md:px-15 pt-20">
      <ScrollToTop />

      <div className="z-[10] top-5 right-5 fixed">
        <UserPopover />
      </div>

      <div className="mx-auto flex w-full flex-col gap-5"
        style={{ maxWidth: `${MAX_LANDING_PAGE_WIDTH}px` }}
      >

        <p className="text-sm text-muted-foreground">
          <a href="/dashboard" data-astro-prefetch="viewport" className="transition-all duration-300 hover:text-foreground">Dashboard</a> / {projectNameForDisplay}
        </p>

        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value as ProjectTab); writeTabToQuery(value); }}>
          <TabsList className="sticky top-5 z-[10]">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-10">

            <div className="flex gap-15 md:flex-row flex-col">

              <div className="space-y-6 md:flex-1">

                <div className="md:max-w-[400px] space-y-6">

                  <div className="flex md:flex-row flex-col md:gap-10 gap-6">
                    <div>
                      <Label>Project Logo</Label>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="flex md:flex-col items-start gap-2">
                          <div
                            className="h-[90px] w-[90px] shrink-0 cursor-pointer relative"
                            onClick={() => {
                              projectLogoInputRef.current?.click();
                            }}
                          >
                            {logoPreview ? (
                              <img
                                src={logoPreview}
                                alt="Project logo"
                                className={`h-full w-full object-cover ${uploadingProjectLogo ? 'animate-pulse' : ''}`}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[24px] font-semibold text-muted-foreground">
                                {projectNameForDisplay.slice(0, 1).toUpperCase() || "P"}
                              </div>
                            )}

                            {editingProject && editableProject?.logoUrl ? (
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-0 right-0 z-2"
                                onClick={() => setDraftProject((prev) => (prev ? { ...prev, logoUrl: null } : prev))}
                                disabled={uploadingProjectLogo || savingProject}
                              >
                                <XIcon />
                              </Button>
                            ) : null}

                          </div>

                        </div>
                        <input
                          type="file"
                          ref={projectLogoInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleProjectLogoUpload(file);
                              event.target.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-5 w-full">
                      <div className="space-y-1">
                        <Label htmlFor="project-name">Project name</Label>
                        {editingProject ?
                          <Input
                            id="project-name"
                            className="mt-1"
                            value={draftProject?.name || ""}
                            onChange={(event) =>
                              setDraftProject((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                            }
                            maxLength={120}
                          /> :
                          <p className="text-[15px]">{projectNameForDisplay}</p>
                        }
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="project-slug">Project URL</Label>
                        {editingProject ?
                          <Input
                            id="project-slug"
                            className="mt-1"
                            value={draftProject?.slug || ""}
                            onChange={(event) => {
                              const normalized = normalizeSlug(event.target.value);
                              setSlugCheckMessage(null);
                              setDraftProject((prev) => (prev ? { ...prev, slug: normalized } : prev));
                            }}
                            maxLength={120}
                          /> :
                          <>
                            {project.isPublic ?
                              <a href={`/${currentUser?.username ?? "user"}/p/${projectSlugForDisplay}`} target="_blank" rel="noopener noreferrer" className="text-[15px]  flex items-center gap-2">/{projectSlugForDisplay} <Rss size={14} /></a>
                              :
                              <p className="text-[15px] text-muted-foreground flex items-center gap-2">/{projectSlugForDisplay} <LockIcon size={14} /></p>
                            }
                          </>
                        }
                        {editingProject && slugCheckMessage ? (
                          <p className="text-xs mt-2 text-destructive">
                            {slugCheckMessage}
                          </p>
                        ) : null}
                      </div>


                    </div>
                  </div>

                  <div className="flex gap-2 w-full">
                    {editingProject ? (
                      <>
                        <Button
                          variant="secondary"
                          onClick={cancelEditProject}
                          disabled={savingProject || isProjectAssetUploading}
                        >
                          <XIcon /> Cancel
                        </Button>
                        <Button

                          onClick={handleSaveProjectDetails}
                          loading={savingProject}
                          disabled={isProjectAssetUploading || savingProject}
                        >
                          <SaveIcon /> Save
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-3 items-center">
                        <Button onClick={beginEditProject}>
                          <PencilIcon /> Edit
                        </Button>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="rounded-[50%]"><Ellipsis /></Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[150px] p-[3px]">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" loading={updatingProjectVisibility} size="sm" className={`w-full ${project.isPublic && "text-primary"}`}>
                                  {project.isPublic ? <RssIcon /> : <LockIcon />}
                                  {project.isPublic ? "Public" : "Draft"}
                                  <ChevronRight className="ml-auto text-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[120px] p-[3px]">
                                <div className="flex flex-col gap-[5px]">
                                  <Button
                                    size="sm"
                                    variant={project.isPublic ? "ghost" : "default"}
                                    onClick={() => { void handleProjectVisibilityChange(false); }}
                                    disabled={updatingProjectVisibility}
                                  >
                                    <LockIcon /> Draft
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={project.isPublic ? "default" : "ghost"}
                                    onClick={() => { void handleProjectVisibilityChange(true); }}
                                    disabled={updatingProjectVisibility}
                                  >
                                    <RssIcon className="mr-1" size={14} /> Public
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>

                            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive w-full justify-start"><Trash2Icon /> Delete</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Delete project?</DialogTitle>
                                  <DialogDescription>
                                    This will delete this project <span className="text-[15px] font-[500]">{projectNameForDisplay}</span> and all its pages
                                  </DialogDescription>
                                </DialogHeader>

                                <DialogFooter>
                                  <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                                    Cancel
                                  </Button>
                                  <Button variant="destructive" onClick={handleDeleteProject} loading={deleteLoading}>
                                    Confirm delete
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </div>





                <div className="space-y-4 mt-15">
                  <Label>Project description</Label>
                  <div className="mt-6">
                    {editingProject ? (
                      <TextEditor
                        initialContent={projectDescription}
                        onChange={(content) => setDraftProject((prev) => (prev ? { ...prev, description: content } : prev))}
                        onImageUpload={onProjectDescriptionImageUpload}
                        placeholder="Write your project description..."
                      />
                    ) : projectDescription.trim().length > 0 ? (
                      <MarkdownRender key={projectPreviewKey} content={projectDescription} />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground h-[250px]">
                        <NotebookPen size={35} />
                        <p>No description provided.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:flex-1 space-y-10">
                <div className="space-y-5">
                  <Label>Pages</Label>

                  <PaperPreviewSheet
                    open={previewOpen}
                    onOpenChange={setPreviewOpen}
                    paper={selectedPaper}
                    handle={currentUser?.username ?? "user"}
                    isMobileUA={isMobileUA}
                    onPaperDeleted={handlePaperDeleted}
                  />


                  {pages.length === 0 ? (
                    <div className="flex flex-col items-center">
                      <EmptyPaperNotes height={180} width={180} />
                      <Label>No pages created</Label>
                      <Button loading={creatingPage} onClick={() => { handleCreatePage(); }} className="mt-5"><PlusIcon /> Create Page</Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-5">
                      <div
                        className="flex cursor-pointer select-none flex-col items-center"
                        onClick={() => {
                          if (creatingPage) return;
                          handleCreatePage();
                        }}
                      >
                        <EmptyPaperNotes />
                        <p className="text-sm">Create page</p>
                      </div>

                      {pages.map((page) => (
                        <PaperCardComponent
                          showStatus
                          key={page.paperId}
                          handle={currentUser?.username ?? "user"}
                          paperData={page}
                          onSelect={(paper) => {
                            setSelectedPaper(paper);
                            setPreviewOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <Label>Collections</Label>

                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    {collections.length === 0 ? (
                      <div className="grid justify-items-center">
                        <FolderNotes height={150} width={150} />
                        <Label>No collections created</Label>
                        <Button
                          className="mt-5"
                          onClick={() => setCreateDialogOpen(true)}
                        >
                          <FolderPlus />
                          Create Collection
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-5">
                        <div className="flex flex-col items-center">
                          <button

                            className="border-0 bg-transparent p-0 outline-0"
                            onClick={() => setCreateDialogOpen(true)}
                            aria-label="Create collection"
                          >
                            <FolderNotes className="opacity-[0.5] transition-all duration-400 hover:opacity-[1]" />
                          </button>
                          <p className="text-sm">Create new collection</p>
                        </div>

                        {collections.map((collection) => (
                          <ProjectCard project={collection} href={`/dashboard/${projectId}/${collection.collectionId}`} />
                        ))}
                      </div>
                    )}

                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create Collection</DialogTitle>
                        <DialogDescription>
                          Pick a name and choose visibility.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-1">
                        <div className="grid gap-2">
                          <Label htmlFor="collection-name">Name</Label>
                          <Input
                            id="collection-name"
                            value={newCollectionName}
                            onChange={(event) => setNewCollectionName(event.target.value)}
                            placeholder="Untitled Collection"
                            maxLength={120}
                          />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="text-sm font-medium">Public collection</p>
                            <p className="text-xs text-muted-foreground">Allow visitors to view this collection.</p>
                          </div>
                          <Switch
                            checked={newCollectionPublic}
                            onCheckedChange={setNewCollectionPublic}
                            aria-label="Toggle public collection"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button

                          variant="secondary"
                          onClick={() => setCreateDialogOpen(false)}
                          disabled={creatingCollection}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateCollection} loading={creatingCollection}>
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </TabsContent>


          <TabsContent value="api" className="mt-10">
            <div className="space-y-6 max-w-[800px] w-full mx-auto">
              <div className="space-y-5">
                {!apiLoading && !apiDoc &&
                  <div className="space-y-2">
                    <Label>Create api key</Label>
                    <p className="text-[15px]">No api key exists for this project, create one to use the contents in your websites and projects</p>
                    <Button onClick={handleCreateApiKey} loading={creatingApiKey}>
                      Create API key
                    </Button>
                  </div>
                }

                <div className="text-sm space-y-3">

                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <Label>Monthly usage</Label>
                      {apiLoading ? (
                        <Skeleton className="h-[14px] w-16" />
                      ) : (
                        <p className="font-[450] text-[12px]">{apiDoc ? apiDoc?.usage : 0} / {apiDoc ? apiDoc.limitPerMonth : DEV_API_LIMIT_PER_MONTH}</p>
                      )}
                    </div>
                    <Progress className="w-full" value={(apiDoc ? apiDoc?.usage : 0) / (apiDoc ? apiDoc.limitPerMonth : DEV_API_LIMIT_PER_MONTH)} />
                  </div>


                  <div className="flex items-center gap-3">
                    <p className="w-[100px] text-muted-foreground">Status</p>
                    {apiLoading ? (
                      <Skeleton className="h-4 w-16" />
                    ) : (
                      <Badge variant={apiDoc?.isActive ? "secondary" : "outline"}>
                        {apiDoc ? (apiDoc.isActive ? "Active" : "Disabled") : "Not created"}
                      </Badge>
                    )}
                  </div>
                  {apiDoc && (
                    <div className="flex items-center gap-3">
                      <p className="w-[100px] text-muted-foreground">Created</p>
                      {apiLoading ? (
                        <Skeleton className="h-4 w-20" />
                      ) : (
                        <p className="font-[450]">{formatFirestoreDate(apiDoc.createdAt)}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  {apiDoc &&
                    <>
                      <Button
                        variant={apiDoc.isActive ? "secondary" : "default"}
                        onClick={() => setToggleConfirmOpen(true)}
                        loading={togglingApiKey || apiLoading}
                        disabled={resettingApiKey}
                      >
                        {apiDoc.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setResetConfirmOpen(true)}
                        disabled={togglingApiKey || resettingApiKey || apiLoading}
                      >
                        Reset
                      </Button>
                    </>
                  }
                </div>

                <ApiShowcase />
              </div>
            </div>

            <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Copy your API key</DialogTitle>
                  <DialogDescription>
                    Save this key now. It is hashed in storage and cannot be shown again.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-md border p-3 break-all font-mono text-xs bg-muted/30">
                  {createdApiKey}
                </div>
                <DialogFooter>
                  <Button onClick={handleCopyCreatedApiKey}>
                    {apiKeyCopied ? <CheckIcon /> : <CopyIcon />}
                    {apiKeyCopied ? "Copied" : "Copy key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{apiDoc?.isActive ? "Disable" : "Enable"} API key?</DialogTitle>
                  <DialogDescription>
                    {apiDoc?.isActive
                      ? "This will deactivate the key. All requests using it will be rejected until re-enabled."
                      : "This will reactivate the key. Requests using it will be accepted again."}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="secondary"
                    onClick={() => setToggleConfirmOpen(false)}
                    disabled={togglingApiKey}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={apiDoc?.isActive ? "destructive" : "default"}
                    onClick={() => { void handleToggleApiKey(!apiDoc?.isActive); }}
                    loading={togglingApiKey}
                  >
                    {apiDoc?.isActive ? "Disable" : "Enable"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Reset API key?</DialogTitle>
                  <DialogDescription>
                    This will invalidate the current key and generate a new one.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button

                    variant="secondary"
                    onClick={() => setResetConfirmOpen(false)}
                    disabled={resettingApiKey}
                  >
                    Cancel
                  </Button>
                  <Button

                    variant="destructive"
                    onClick={handleResetApiKey}
                    loading={resettingApiKey}
                  >
                    Reset
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

