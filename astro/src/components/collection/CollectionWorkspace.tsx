import { useEffect, useState } from "react";
import { Copy, Ellipsis, LockIcon, NotebookPen, PencilIcon, PlusIcon, RssIcon, SaveIcon, XIcon } from "lucide-react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { copyToClipboardWithToast, normalizeSlug } from "@/lib/utils";
import { sortPapersLatestFirst } from "@/lib/paperSort";
import { createPaper, listOwnedPapers } from "@/lib/api/papers";
import {
  checkCollectionSlugAvailable,
  deleteCollection,
  updateCollection,
  updateCollectionVisibility,
} from "@/lib/api/collections";
import { MAX_DESCRIPTION_LENGTH, MAX_PAPERS_PER_USER } from "@/lib/limits";
import type { CollectionDoc, PaperDoc, UserDoc } from "@/lib/entities";
import EmptyPaperNotes from "../emptyPagesComp";
import PaperCardComponent from "../paperCardComponent";
import PaperPreviewSheet from "../paperPreviewSheet";
import ScrollToTop from "../scrollToTop";

type CollectionWorkspaceProps = {
  projectId: string;
  collectionId: string;
  initialProjectName: string;
  initialCollection: CollectionDoc;
  initialPages: PaperDoc[];
  initialUser?: UserDoc | null;
  isMobileUA: boolean;
};

export default function CollectionWorkspace({
  projectId,
  collectionId,
  initialProjectName,
  initialCollection,
  initialPages,
  initialUser,
  isMobileUA,
}: CollectionWorkspaceProps) {
  const [collection, setCollection] = useState<CollectionDoc | null>(initialCollection);
  const [draftCollection, setDraftCollection] = useState<CollectionDoc | null>(null);
  const [pages, setPages] = useState<PaperDoc[]>(() => sortPapersLatestFirst(initialPages));
  const [creatingPage, setCreatingPage] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<PaperDoc | null>(null);
  const [editingCollection, setEditingCollection] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [updatingCollectionVisibility, setUpdatingCollectionVisibility] = useState(false);
  const [slugCheckMessage, setSlugCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    setCollection(initialCollection);
    setDraftCollection(null);
    setPages(sortPapersLatestFirst(initialPages));
    setEditingCollection(false);
    setSlugCheckMessage(null);
  }, [initialCollection, initialPages]);

  useEffect(() => {
    document.documentElement.dataset.collectionWorkspaceReady = "true";
    return () => {
      delete document.documentElement.dataset.collectionWorkspaceReady;
    };
  }, []);

  function beginEditCollection() {
    if (!collection) return;
    setDraftCollection({ ...collection });
    setSlugCheckMessage(null);
    setEditingCollection(true);
  }

  function cancelEditCollection() {
    setDraftCollection(null);
    setSlugCheckMessage(null);
    setEditingCollection(false);
  }

  async function handleCreatePage() {
    if (!collection) return;
    setCreatingPage(true);
    try {
      const ownedPapers = await listOwnedPapers();
      if (ownedPapers.length >= MAX_PAPERS_PER_USER) {
        toast.error(`Paper limit reached (${MAX_PAPERS_PER_USER}) for this user. Delete an existing paper to create a new one.`);
        return;
      }

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
      // toast.promise handles failure UI.
    } finally {
      setCreatingPage(false);
    }
  }

  async function handleSaveCollectionDetails() {
    if (!collection || !draftCollection) return;
    if (!draftCollection.name.trim()) {
      toast.error("Collection name cannot be empty.");
      return;
    }

    if ((draftCollection.description || "").length > MAX_DESCRIPTION_LENGTH) {
      toast.error(`Collection description is too long. Maximum length is ${MAX_DESCRIPTION_LENGTH} characters.`);
      return;
    }

    const normalizedSlug = normalizeSlug(draftCollection.slug || "");
    if (!normalizedSlug) {
      setSlugCheckMessage("Slug is required.");
      toast.error("Collection slug cannot be empty.");
      return;
    }
    if (normalizedSlug.length < 2) {
      setSlugCheckMessage("Slug must be at least 2 characters.");
      toast.error("Collection slug must be at least 2 characters.");
      return;
    }

    if (normalizedSlug !== collection.slug) {
      try {
        const available = await checkCollectionSlugAvailable(normalizedSlug, collection.projectId, collection.collectionId);
        if (!available) {
          setSlugCheckMessage("Slug is already in use.");
          toast.error("Collection slug is already in use.");
          return;
        }
      } catch {
        setSlugCheckMessage("Unable to validate slug right now.");
        toast.error("Unable to validate collection slug.");
        return;
      }
    }

    setSlugCheckMessage(null);
    setSavingCollection(true);
    const savePromise = updateCollection(collection.collectionId, {
      name: draftCollection.name.trim(),
      slug: normalizedSlug,
      description: draftCollection.description || null,
    });

    toast.promise(savePromise, {
      loading: "Saving collection details...",
      success: "Collection details updated.",
      error: (error) => (error instanceof Error ? error.message : "Failed to save collection details."),
    });

    try {
      const updated = await savePromise;
      setCollection(updated);
      setDraftCollection(null);
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
      setDraftCollection((prev) => (prev ? { ...prev, isPublic: updated.isPublic, updatedAt: updated.updatedAt } : prev));
    } catch {
      // toast.promise handles failure UI.
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

  function handlePaperDeleted(paperId: string) {
    setPages((prev) => prev.filter((paper) => paper.paperId !== paperId));
    setSelectedPaper((prev) => (prev?.paperId === paperId ? null : prev));
    setPreviewOpen(false);
  }

  if (!collection || !initialUser || collection.collectionId !== collectionId) {
    return null;
  }

  const editableCollection = editingCollection ? draftCollection : collection;
  const collectionNameForDisplay = editableCollection?.name || collection.name;
  const collectionSlugForDisplay = editableCollection?.slug || collection.slug;
  const collectionDescription = editableCollection?.description || "";

  return (
    <div className="min-h-screen bg-background px-[15px] pt-15 pb-20">
      <ScrollToTop />
      <div className="z-[10] fixed top-4 right-4">
        <UserPopover user={initialUser} />
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">
            <a href={`/dashboard/${projectId}`} data-astro-prefetch="viewport" className="transition-all duration-300 hover:text-foreground">{initialProjectName}</a> / {collectionNameForDisplay}
          </p>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <div className="space-y-6 md:flex-2">
            <div className="flex items-center gap-2 justify-end">
              {editingCollection ? (
                <>
                  <Button
                    
                    variant="secondary"
                    onClick={cancelEditCollection}
                    disabled={savingCollection}
                  >
                    <XIcon /> Cancel
                  </Button>
                  <Button
                    
                    onClick={handleSaveCollectionDetails}
                    loading={savingCollection}
                    disabled={savingCollection}
                  >
                    <SaveIcon /> Save
                  </Button>
                </>
              ) : (
                <Button  onClick={beginEditCollection}>
                  <PencilIcon /> Edit
                </Button>
              )}
            </div>

            <div className="flex md:flex-row flex-col md:gap-10 gap-6">
              <div className="flex flex-col gap-5 w-full">
                <div>
                  <Label>Collection ID</Label>
                  <div className="flex items-center gap-4 justify-between">
                    <p className="text-sm font-mono text-muted-foreground break-all">{collection.collectionId}</p>
                    <Button
                      
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        void copyToClipboardWithToast(collection.collectionId, "Collection ID copied.");
                      }}
                    >
                      <Copy />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="collection-name">Collection name</Label>
                  {editingCollection ? (
                    <Input
                      id="collection-name"
                      value={draftCollection?.name || ""}
                      className="mt-2 md:w-[300px]"
                      onChange={(event) =>
                        setDraftCollection((prev) =>
                          prev ? { ...prev, name: event.target.value } : prev,
                        )
                      }
                      maxLength={120}
                    />
                  ) : (
                    <p className="mt-[5px]">{collectionNameForDisplay}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="collection-slug">Collection Slug</Label>
                  {editingCollection ? (
                    <Input
                      id="collection-slug"
                      value={draftCollection?.slug || ""}
                      className="mt-2 w-[300px]"
                      onChange={(event) => {
                        const normalized = normalizeSlug(event.target.value);
                        setSlugCheckMessage(null);
                        setDraftCollection((prev) => (prev ? { ...prev, slug: normalized } : prev));
                      }}
                      maxLength={120}
                    />
                  ) : (
                    <p className="mt-[5px]">/{collectionSlugForDisplay}</p>
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
                          <Button  variant="outline" size="icon" className="rounded-[50%]">
                            <Ellipsis className="text-destructive" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Button
                            
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
                          <Button  variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                            Cancel
                          </Button>
                          <Button  variant="destructive" onClick={handleDeleteCollection} loading={deleteLoading}>
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
                    value={draftCollection?.description || ""}
                    onChange={(event) =>
                      setDraftCollection((prev) =>
                        prev ? { ...prev, description: event.target.value } : prev,
                      )
                    }
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
                      showStatus
                      key={page.paperId}
                      handle={initialUser?.username ?? "user"}
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
          </div>
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
    </div>
  );
}

