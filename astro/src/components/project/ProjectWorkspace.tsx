import { useEffect, useRef, useState } from "react";
import { Ellipsis, FolderPlus, LockIcon, NotebookPen, PencilIcon, PlusIcon, RssIcon, SaveIcon, SquareArrowOutUpLeft, SquareArrowOutUpRight, SquareArrowUpRight, TrashIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import FolderNotes from "@/components/folderComponent";
import TextEditor from "@/components/pre_made_components/editor/textEditor";
import PostRender from "@/components/pre_made_components/render/postPreview";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createCollection } from "@/lib/api/collections";
import { createPaper } from "@/lib/api/papers";
import {
  checkProjectSlugAvailable,
  deleteProject,
  updateProject,
  updateProjectVisibility,
} from "@/lib/api/projects";
import { uploadProjectEmbeddedImage, uploadProjectLogo } from "@/lib/api/uploads";
import {
  MAX_EMBEDDED_HEIGHT,
  MAX_EMBEDDED_WIDTH,
  MAX_PROJECT_LOGO_HEIGHT,
  MAX_PROJECT_LOGO_WIDTH,
} from "@/lib/constants";
import type { CollectionDoc, PaperDoc, ProjectDoc, UserDoc } from "@/lib/types";
import { compressImage } from "@/lib/utils";
import EmptyPaperNotes from "../emptyPagesComp";
import PaperCardComponent from "../paperCardComponent";
import ScrollToTop from "../scrollToTop";

type ProjectWorkspaceProps = {
  projectId: string;
  initialProject: ProjectDoc;
  initialPages: PaperDoc[];
  initialCollections: CollectionDoc[];
  initialUser?: UserDoc | null;
};

type ProjectTab = "overview" | "api";

const projectTabs: ProjectTab[] = ["overview", "api"];

function normalizeProjectSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readTabFromQuery(): ProjectTab {
  if (typeof window === "undefined") {
    return "overview";
  }

  const rawTab = new URLSearchParams(window.location.search).get("tab");
  if (rawTab && projectTabs.includes(rawTab as ProjectTab)) {
    return rawTab as ProjectTab;
  }

  return "overview";
}

function writeTabToQuery(tab: ProjectTab): void {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", tab);
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.pushState({}, "", url);
}

export default function ProjectWorkspace({
  projectId,
  initialProject,
  initialPages,
  initialCollections,
  initialUser,
}: ProjectWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ProjectTab>(readTabFromQuery);
  const [project, setProject] = useState<ProjectDoc>(initialProject);
  const [pages, setPages] = useState<PaperDoc[]>(initialPages);
  const [collections, setCollections] = useState<CollectionDoc[]>(initialCollections);
  const [editingProject, setEditingProject] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [uploadingProjectLogo, setUploadingProjectLogo] = useState(false);
  const [uploadingProjectEmbeddedCount, setUploadingProjectEmbeddedCount] = useState(0);
  const [tempUploadingProjectLogo, setTempUploadingProjectLogo] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionPublic, setNewCollectionPublic] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState(true);
  const [slugCheckMessage, setSlugCheckMessage] = useState<string | null>(null);
  const [updatingProjectVisibility, setUpdatingProjectVisibility] = useState(false);
  const projectLogoInputRef = useRef<HTMLInputElement>(null);

  const isProjectAssetUploading = uploadingProjectLogo || uploadingProjectEmbeddedCount > 0;

  useEffect(() => {
    setProject(initialProject);
    setPages(initialPages);
    setCollections(initialCollections);
    setEditingProject(false);
  }, [initialProject, initialPages, initialCollections]);


  useEffect(() => {
    if (!editingProject) {
      setCheckingSlug(false);
      setIsSlugAvailable(true);
      setSlugCheckMessage(null);
      return;
    }

    const normalized = normalizeProjectSlug(project.slug || "");

    if (!normalized) {
      setCheckingSlug(false);
      setIsSlugAvailable(false);
      setSlugCheckMessage("Slug is required.");
      return;
    }

    if (normalized.length < 2) {
      setCheckingSlug(false);
      setIsSlugAvailable(false);
      setSlugCheckMessage("Slug must be at least 2 characters.");
      return;
    }

    if (normalized === project.slug) {
      setCheckingSlug(false);
      setIsSlugAvailable(true);
      setSlugCheckMessage(null);
      return;
    }

    let active = true;
    setCheckingSlug(true);
    setSlugCheckMessage(null);

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const available = await checkProjectSlugAvailable(normalized, project.projectId);
          if (!active) return;
          setIsSlugAvailable(available);
          if (!available) {
            setSlugCheckMessage("Slug is already in use.");
          } else {
            setSlugCheckMessage(null);
          }
        } catch {
          if (!active) return;
          setIsSlugAvailable(false);
          setSlugCheckMessage("Unable to validate slug right now.");
        } finally {
          if (active) {
            setCheckingSlug(false);
          }
        }
      })();
    }, 400);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [editingProject, project.slug]);


  useEffect(() => {
    document.documentElement.dataset.projectWorkspaceReady = "true";
    return () => {
      delete document.documentElement.dataset.projectWorkspaceReady;
      if (tempUploadingProjectLogo) {
        URL.revokeObjectURL(tempUploadingProjectLogo);
      }
    };
  }, [tempUploadingProjectLogo]);

  async function handleSaveProjectDetails() {
    if (!project.name.trim()) {
      toast.error("Project name cannot be empty.");
      return;
    }

    const normalizedSlug = normalizeProjectSlug(project.slug || "");
    if (!normalizedSlug) {
      toast.error("Project slug cannot be empty.");
      return;
    }
    if (normalizedSlug.length < 2) {
      toast.error("Project slug must be at least 2 characters.");
      return;
    }

    if (normalizedSlug !== initialProject.slug) {
      try {
        const available = await checkProjectSlugAvailable(normalizedSlug, project.projectId);
        if (!available) {
          setIsSlugAvailable(false);
          setSlugCheckMessage("Slug is already in use.");
          toast.error("Project slug is already in use.");
          return;
        }
      } catch {
        toast.error("Unable to validate project slug.");
        return;
      }
    }

    setSavingProject(true);
    const savePromise = updateProject(project.projectId, {
      name: project.name,
      slug: normalizedSlug,
      description: project.description || null,
      logoUrl: project.logoUrl ?? null,
    });
    toast.promise(savePromise, {
      loading: "Saving project details...",
      success: "Project details updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to save project details."),
    });

    try {
      const updated = await savePromise;
      setProject(updated);
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

    const previousIsPublic = project.isPublic;
    setProject((prev) => ({ ...prev, isPublic: nextIsPublic }));
    setUpdatingProjectVisibility(true);

    const visibilityPromise = updateProjectVisibility(project.projectId, nextIsPublic);
    toast.promise(visibilityPromise, {
      loading: "Updating project status...",
      success: "Project status updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to update project status."),
    });

    try {
      const updated = await visibilityPromise;
      setProject((prev) => ({
        ...prev,
        isPublic: updated.isPublic,
        updatedAt: updated.updatedAt,
      }));
    } catch {
      setProject((prev) => ({ ...prev, isPublic: previousIsPublic }));
    } finally {
      setUpdatingProjectVisibility(false);
    }
  }

  async function handleProjectLogoUpload(file: File) {
    if (!project) return;

    setUploadingProjectLogo(true);
    let localPreview: string | null = null;

    const uploadPromise = (async () => {
      const compressed = await compressImage({
        file,
        maxWidth: MAX_PROJECT_LOGO_WIDTH,
        maxHeight: MAX_PROJECT_LOGO_HEIGHT,
        crop: true,
      });

      const compressedBlob =
        compressed instanceof Blob
          ? compressed
          : new Blob([new Uint8Array(compressed as unknown as ArrayBuffer)], { type: "image/jpeg" });

      const uploadableFile =
        compressedBlob instanceof File
          ? compressedBlob
          : new File([compressedBlob], file.name || "project-logo.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

      localPreview = URL.createObjectURL(uploadableFile);
      setTempUploadingProjectLogo(localPreview);
      return uploadProjectLogo(project.projectId, uploadableFile);
    })();

    toast.promise(uploadPromise, {
      loading: "Uploading project logo...",
      success: "Project logo uploaded.",
      error: (error) => (error instanceof Error ? error.message : "Project logo upload failed."),
    });

    try {
      const uploaded = await uploadPromise;
      setProject((prev) => ({ ...prev, logoUrl: uploaded.url }));
    } catch {
      // toast.promise handles failure UI.
    } finally {
      if (localPreview) {
        URL.revokeObjectURL(localPreview);
      }
      setTempUploadingProjectLogo(null);
      setUploadingProjectLogo(false);
    }
  }

  async function onProjectDescriptionImageUpload(file: File): Promise<{ success: boolean; url?: string; message?: string }> {
    if (!project) {
      return { success: false, message: "Project is not available." };
    }

    setUploadingProjectEmbeddedCount((prev) => prev + 1);

    const uploadPromise = (async () => {
      const compressed = await compressImage({
        file,
        maxWidth: MAX_EMBEDDED_WIDTH,
        maxHeight: MAX_EMBEDDED_HEIGHT,
        crop: false,
      });

      const compressedBlob =
        compressed instanceof Blob
          ? compressed
          : new Blob([new Uint8Array(compressed as unknown as ArrayBuffer)], { type: "image/jpeg" });

      const uploadableFile =
        compressedBlob instanceof File
          ? compressedBlob
          : new File([compressedBlob], file.name || "embedded.jpg", {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

      return uploadProjectEmbeddedImage(project.projectId, uploadableFile);
    })();

    toast.promise(uploadPromise, {
      loading: "Uploading image...",
      success: "Image uploaded.",
      error: (error) => (error instanceof Error ? error.message : "Image upload failed."),
    });

    try {
      const uploaded = await uploadPromise;
      return { success: true, url: uploaded.url };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : "Upload failed." };
    } finally {
      setUploadingProjectEmbeddedCount((prev) => Math.max(0, prev - 1));
    }
  }

  async function handleCreatePage() {
    if (!project) return;
    setCreatingPage(true);
    try {
      const createPromise = createPaper({ projectId: project.projectId });
      toast.promise(createPromise, {
        loading: "Creating page...",
        success: "Page created.",
        error: "Failed to create page.",
      });
      const paper = await createPromise;
      window.location.href = `/write/${paper.paperId}`;
    } catch {
      setCreatingPage(false);
    }
  }

  async function handleCreateCollection() {
    if (!project) return;
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



  if (!initialUser) {
    return null;
  }

  const logoPreview = tempUploadingProjectLogo || project.logoUrl || "";
  const projectDescription = project.description || "";
  const projectPreviewKey = `${project.projectId}:${project.updatedAt}:${projectDescription.length}`;

  return (
    <div className="min-h-screen bg-background px-[15px] pt-15 pb-20">
      <ScrollToTop />
      <div className="z-[10] fixed top-4 right-4">
        <UserPopover user={initialUser} />
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">
            <a href="/dashboard" className="transition-all duration-300 hover:text-foreground">Dashboard</a> / {project.name}
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const nextTab = projectTabs.includes(value as ProjectTab)
              ? (value as ProjectTab)
              : "overview";
            setActiveTab(nextTab);
            writeTabToQuery(nextTab);
          }}
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <div className="flex flex-col gap-8 md:flex-row">
              <div className="space-y-6 md:flex-2">
                <div className="flex items-center gap-2 justify-end w-full">
                  {editingProject ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setProject(initialProject);
                          setSlugCheckMessage(null);
                          setEditingProject(false);
                        }}
                        disabled={savingProject || isProjectAssetUploading}
                      >
                        <XIcon /> Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveProjectDetails}
                        loading={savingProject}
                        disabled={isProjectAssetUploading || checkingSlug || !isSlugAvailable}
                      >
                        <SaveIcon /> Save
                      </Button>
                    </>
                  ) : (
                    <Button type="button" onClick={() => setEditingProject(true)}>
                      <PencilIcon /> Edit
                    </Button>
                  )}
                </div>



                <div className="flex md:flex-row flex-col md:gap-10 gap-6">
                  <div>
                    <Label>Project Logo</Label>
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex md:flex-col items-start gap-2">
                        <button
                          type="button"
                          className="h-[90px] w-[90px] shrink-0 overflow-hidden rounded-md border"
                          onClick={() => {
                            if (!editingProject) return;
                            projectLogoInputRef.current?.click();
                          }}
                          disabled={!editingProject}
                        >
                          {logoPreview ? (
                            <img
                              src={logoPreview}
                              alt="Project logo"
                              className={`h-full w-full object-cover ${uploadingProjectLogo ? 'animate-pulse' : ''}`}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[24px] font-semibold text-muted-foreground">
                              {project.name.slice(0, 1).toUpperCase() || "P"}
                            </div>
                          )}
                        </button>
                        {editingProject && project.logoUrl ? (
                          <Button
                            type="button"
                            variant="destructive"
                            className="md:w-full"
                            onClick={() => setProject((prev) => ({ ...prev, logoUrl: null }))}
                            disabled={uploadingProjectLogo || savingProject}
                          >
                            Remove
                          </Button>
                        ) : null}
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

                  <div className="flex flex-col gap-5 w-full ">
                    <div>
                      <Label htmlFor="project-name">Project name</Label>
                      {editingProject ?
                        <Input
                          id="project-name"
                          value={project.name}
                          className="mt-2 md:w-[300px]"
                          onChange={(event) => setProject((prev) => ({ ...prev, name: event.target.value }))}
                          maxLength={120}
                        /> :
                        <p className="mt-[5px]">{project.name}</p>
                      }
                    </div>

                    <div>
                      <Label htmlFor="project-slug">Project URL</Label>
                      {editingProject ?
                        <Input
                          id="project-slug"
                          value={project.slug}
                          className="mt-2 md:w-[300px]"
                          onChange={(event) => {
                            const normalized = normalizeProjectSlug(event.target.value);
                            setProject((prev) => ({ ...prev, slug: normalized }));
                          }}
                          maxLength={120}
                        /> :
                        <p className="mt-[5px]">/{project.slug}</p>
                      }
                      {editingProject && slugCheckMessage ? (
                        <p className="text-xs mt-2 text-destructive">
                          {slugCheckMessage}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <Label>Status</Label>
                      <div className="mt-2 w-full flex items-center justify-between gap-2">

                        <div className="flex gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant={editingProject ? "secondary" : "outline"} loading={updatingProjectVisibility} className={`w-[100px] ${project.isPublic && "text-primary"}`}>
                                {project.isPublic ? <RssIcon size={14} /> : <LockIcon size={14} />}
                                {project.isPublic ? "Public" : "Draft"}
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
                                  <LockIcon className="mr-1" size={14} /> Draft
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
                          {project.isPublic && initialUser &&
                            <a target="_blank" href={`/${initialUser.username}/p/${project.slug}`}>
                              <Button variant="ghost">Open <SquareArrowOutUpRight /></Button>
                            </a>
                          }

                        </div>




                        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" size="icon" className="rounded-[50%]">
                                <Ellipsis className="text-destructive" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-destructive"
                                onClick={() => setDeleteOpen(true)}
                              >
                                Delete project
                              </Button>
                            </PopoverContent>
                          </Popover>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete project?</DialogTitle>
                              <DialogDescription>
                                This will delete this project <span className="text-[15px] font-[500]">{project.name}</span> and all its pages
                              </DialogDescription>
                            </DialogHeader>

                            <DialogFooter>
                              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                                Cancel
                              </Button>
                              <Button type="button" variant="destructive" onClick={handleDeleteProject} loading={deleteLoading}>
                                Confirm delete
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>

                    </div>
                  </div>
                </div>




                <div className="space-y-4 mt-15">
                  <Label>Project description</Label>
                  <div className="mt-6">
                    {editingProject ? (
                      <TextEditor
                        initialContent={projectDescription}
                        onChange={(content) => setProject((prev) => ({ ...prev, description: content }))}
                        onImageUpload={onProjectDescriptionImageUpload}
                        placeholder="Write your project description..."
                      />
                    ) : projectDescription.trim().length > 0 ? (
                      <PostRender key={projectPreviewKey} content={projectDescription} />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground h-[250px]">
                        <NotebookPen size={35} />
                        <p>No description provided.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-12 md:flex-2">
                <div className="space-y-5">
                  <Label>Pages</Label>

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
                          handle={initialUser?.username ?? "user"}
                          paperData={page}
                          onDeleted={(paperId) => setPages((prev) => prev.filter((p) => p.paperId !== paperId))}
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
                            type="button"
                            className="border-0 bg-transparent p-0 outline-0"
                            onClick={() => setCreateDialogOpen(true)}
                            aria-label="Create collection"
                          >
                            <FolderNotes className="opacity-[0.5] transition-all duration-400 hover:opacity-[1]" />
                          </button>
                          <p className="text-sm">Create new collection</p>
                        </div>

                        {collections.map((collection) => (
                          <div key={collection.collectionId} className="flex flex-col items-center">
                            <a href={`/dashboard/${projectId}/${collection.collectionId}`}>
                              <div className="relative inline-flex">
                                <FolderNotes />
                                {!collection.isPublic ? (
                                  <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                                    <LockIcon size={12} />
                                  </span>
                                ) : null}
                              </div>
                            </a>
                            <p className="text-sm">{collection.name}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{collection.pagesNumber} pages</p>
                          </div>
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
                          type="button"
                          variant="secondary"
                          onClick={() => setCreateDialogOpen(false)}
                          disabled={creatingCollection}
                        >
                          Cancel
                        </Button>
                        <Button type="button" onClick={handleCreateCollection} loading={creatingCollection}>
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="api">
            api coming soon...
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
}
