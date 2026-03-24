import { useEffect, useState } from "react";
import { Ellipsis, LockIcon, NotebookPen, PencilIcon, PlusIcon, RssIcon, SaveIcon, XIcon } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createPaper } from "@/lib/api/papers";
import {
  checkCollectionSlugAvailable,
  deleteCollection,
  updateCollection,
  updateCollectionVisibility,
} from "@/lib/api/collections";
import type { CollectionDoc, PaperDoc, UserDoc } from "@/lib/types";
import EmptyPaperNotes from "../emptyPagesComp";
import PaperCardComponent from "../paperCardComponent";

type CollectionWorkspaceProps = {
  projectId: string;
  collectionId: string;
  initialCollection: CollectionDoc;
  initialPages: PaperDoc[];
  initialUser?: UserDoc | null;
};

function normalizeCollectionSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CollectionWorkspace({
  projectId,
  collectionId,
  initialCollection,
  initialPages,
  initialUser,
}: CollectionWorkspaceProps) {
  const [collection, setCollection] = useState<CollectionDoc | null>(initialCollection);
  const [pages, setPages] = useState<PaperDoc[]>(initialPages);
  const [creatingPage, setCreatingPage] = useState(false);
  const [editingCollection, setEditingCollection] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updatingCollectionVisibility, setUpdatingCollectionVisibility] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState(true);
  const [slugCheckMessage, setSlugCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    setCollection(initialCollection);
    setPages(initialPages);
    setEditingCollection(false);
  }, [initialCollection, initialPages]);

  useEffect(() => {
    if (!editingCollection || !collection) {
      setCheckingSlug(false);
      setIsSlugAvailable(true);
      setSlugCheckMessage(null);
      return;
    }

    const normalized = normalizeCollectionSlug(collection.slug || "");

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

    if (normalized === collection.slug) {
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
          const available = await checkCollectionSlugAvailable(normalized, collection.projectId, collection.collectionId);
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
  }, [editingCollection, collection?.slug, collection?.projectId, collection?.collectionId]);

  useEffect(() => {
    document.documentElement.dataset.collectionWorkspaceReady = "true";
    return () => {
      delete document.documentElement.dataset.collectionWorkspaceReady;
    };
  }, []);

  async function handleCreatePage() {
    if (!collection) return;
    setCreatingPage(true);
    try {
      const createPromise = createPaper({
        projectId: collection.projectId,
        collectionId: collection.collectionId,
      });
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

  async function handleSaveCollectionDetails() {
    if (!collection) return;
    if (!collection.name.trim()) {
      toast.error("Collection name cannot be empty.");
      return;
    }

    const normalizedSlug = normalizeCollectionSlug(collection.slug || "");
    if (!normalizedSlug) {
      toast.error("Collection slug cannot be empty.");
      return;
    }
    if (normalizedSlug.length < 2) {
      toast.error("Collection slug must be at least 2 characters.");
      return;
    }

    if (normalizedSlug !== initialCollection.slug) {
      try {
        const available = await checkCollectionSlugAvailable(normalizedSlug, collection.projectId, collection.collectionId);
        if (!available) {
          setIsSlugAvailable(false);
          setSlugCheckMessage("Slug is already in use.");
          toast.error("Collection slug is already in use.");
          return;
        }
      } catch {
        toast.error("Unable to validate collection slug.");
        return;
      }
    }

    setSavingCollection(true);
    const savePromise = updateCollection(collection.collectionId, {
      name: collection.name,
      slug: normalizedSlug,
      description: collection.description || null,
    });

    toast.promise(savePromise, {
      loading: "Saving collection details...",
      success: "Collection details updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to save collection details."),
    });

    try {
      const updated = await savePromise;
      setCollection(updated);
      setSlugCheckMessage(null);
      setEditingCollection(false);
    } catch {
      // toast.promise handles failure UI.
    } finally {
      setSavingCollection(false);
    }
  }

  async function handleCollectionVisibilityChange(nextIsPublic: boolean) {
    if (!collection || updatingCollectionVisibility || collection.isPublic === nextIsPublic) {
      return;
    }

    const previousIsPublic = collection.isPublic;
    setCollection((prev) => (prev ? { ...prev, isPublic: nextIsPublic } : prev));
    setUpdatingCollectionVisibility(true);

    const visibilityPromise = updateCollectionVisibility(collection.collectionId, nextIsPublic);
    toast.promise(visibilityPromise, {
      loading: "Updating collection status...",
      success: "Collection status updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to update collection status."),
    });

    try {
      const updated = await visibilityPromise;
      setCollection(updated);
    } catch {
      setCollection((prev) => (prev ? { ...prev, isPublic: previousIsPublic } : prev));
    } finally {
      setUpdatingCollectionVisibility(false);
    }
  }

  async function handleDeleteCollection() {
    if (!collection) return;
    setDeleteLoading(true);
    try {
      await deleteCollection(collection.collectionId);
      window.location.href = `/dashboard/${projectId}`;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete collection.");
      setDeleteLoading(false);
    }
  }

  if (!collection || !initialUser || collection.collectionId !== collectionId) {
    return null;
  }

  const collectionDescription = collection.description || "";

  return (
    <div className="min-h-screen bg-background px-[15px] pt-15 pb-20">
      <div className="z-[10] fixed top-0 left-0 flex w-full justify-end p-[10px]">
        <UserPopover user={initialUser} />
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">
            <a href={`/dashboard/${projectId}`} className="transition-all duration-300 hover:text-foreground">Project</a> / {collection.name}
          </p>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <div className="space-y-6 md:flex-2">
            <div className="flex items-center gap-2 justify-end md:w-[480px]">
              {editingCollection ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setCollection(initialCollection);
                      setSlugCheckMessage(null);
                      setEditingCollection(false);
                    }}
                    disabled={savingCollection}
                  >
                    <XIcon /> Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveCollectionDetails}
                    loading={savingCollection}
                    disabled={checkingSlug || !isSlugAvailable}
                  >
                    <SaveIcon /> Save
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setEditingCollection(true)}>
                  <PencilIcon /> Edit
                </Button>
              )}
            </div>

            <div className="flex md:flex-row flex-col md:gap-10 gap-6">
              <div className="flex flex-col gap-5 w-full md:w-[480px]">
                <div>
                  <Label htmlFor="collection-name">Collection name</Label>
                  {editingCollection ? (
                    <Input
                      id="collection-name"
                      value={collection.name}
                      className="mt-2"
                      onChange={(event) => setCollection((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                      maxLength={120}
                    />
                  ) : (
                    <p className="mt-[5px]">{collection.name}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="collection-slug">Collection URL</Label>
                  {editingCollection ? (
                    <Input
                      id="collection-slug"
                      value={collection.slug}
                      className="mt-2"
                      onChange={(event) => {
                        const normalized = normalizeCollectionSlug(event.target.value);
                        setCollection((prev) => (prev ? { ...prev, slug: normalized } : prev));
                      }}
                      maxLength={120}
                    />
                  ) : (
                    <p className="mt-[5px]">/{collection.slug}</p>
                  )}
                  {editingCollection && slugCheckMessage ? (
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
                          <Button variant={editingCollection ? "secondary" : "outline"} loading={updatingCollectionVisibility} className={`w-[100px] ${collection.isPublic && "text-primary"}`}>
                            {collection.isPublic ? <RssIcon size={14} /> : <LockIcon size={14} />}
                            {collection.isPublic ? "Public" : "Draft"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[120px] p-[3px]">
                          <div className="flex flex-col gap-[5px]">
                            <Button
                              size="sm"
                              variant={collection.isPublic ? "ghost" : "default"}
                              onClick={() => { void handleCollectionVisibilityChange(false); }}
                              disabled={updatingCollectionVisibility}
                            >
                              <LockIcon className="mr-1" size={14} /> Draft
                            </Button>
                            <Button
                              size="sm"
                              variant={collection.isPublic ? "default" : "ghost"}
                              onClick={() => { void handleCollectionVisibilityChange(true); }}
                              disabled={updatingCollectionVisibility}
                            >
                              <RssIcon className="mr-1" size={14} /> Public
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
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
                            Delete collection
                          </Button>
                        </PopoverContent>
                      </Popover>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete collection?</DialogTitle>
                          <DialogDescription>
                            This will delete this collection <span className="text-[15px] font-[500]">{collection.name}</span> and all its pages
                          </DialogDescription>
                        </DialogHeader>

                        <DialogFooter>
                          <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                            Cancel
                          </Button>
                          <Button type="button" variant="destructive" onClick={handleDeleteCollection} loading={deleteLoading}>
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
              <Label>Collection description</Label>
              <div className="mt-2">
                {editingCollection ? (
                  <textarea
                    value={collectionDescription}
                    onChange={(event) => setCollection((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                    placeholder="Write your collection description..."
                    className="w-full min-h-[180px] resize-y bg-transparent p-0 text-sm outline-none"
                    maxLength={50000}
                  />
                ) : collectionDescription.trim().length > 0 ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{collectionDescription}</p>
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
                  <Button loading={creatingPage} onClick={() => { void handleCreatePage(); }} className="mt-5"><PlusIcon /> Create Page</Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-5">
                  <div
                    className="flex cursor-pointer select-none flex-col items-center"
                    onClick={() => {
                      if (creatingPage) return;
                      void handleCreatePage();
                    }}
                  >
                    <EmptyPaperNotes />
                    <p className="text-sm">Create page</p>
                  </div>

                  {pages.map((page) => (
                    <PaperCardComponent
                      key={page.paperId}
                      handle={initialUser?.username ?? "user"}
                      paperData={page}
                      onDeleted={(paperId) => setPages((prev) => prev.filter((p) => p.paperId !== paperId))}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
