import { useEffect, useState } from "react";
import { LockIcon, PlusIcon, RssIcon } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createPaper } from "@/lib/api/papers";
import {
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

type CollectionTab = "papers" | "settings";

const collectionTabs: CollectionTab[] = ["papers", "settings"];

function readTabFromQuery(): CollectionTab {
    if (typeof window === "undefined") {
        return "papers";
    }

    const rawTab = new URLSearchParams(window.location.search).get("tab");
    if (rawTab && collectionTabs.includes(rawTab as CollectionTab)) {
        return rawTab as CollectionTab;
    }

    return "papers";
}

function writeTabToQuery(tab: CollectionTab): void {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.pushState({}, "", url);
}

export default function CollectionWorkspace({
    projectId,
    collectionId,
    initialCollection,
    initialPages,
    initialUser,
}: CollectionWorkspaceProps) {
    const [activeTab, setActiveTab] = useState<CollectionTab>(readTabFromQuery);
    const [collection, setCollection] = useState<CollectionDoc | null>(initialCollection);
    const [pages, setPages] = useState<PaperDoc[]>(initialPages);
    const [creatingPage, setCreatingPage] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editName, setEditName] = useState(initialCollection.name);
    const [editDescription, setEditDescription] = useState(initialCollection.description || "");
    const [savingEdit, setSavingEdit] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [updatingCollectionVisibility, setUpdatingCollectionVisibility] = useState(false);

    useEffect(() => {
        setCollection(initialCollection);
        setPages(initialPages);
        setEditName(initialCollection.name);
        setEditDescription(initialCollection.description || "");
    }, [initialCollection, initialPages]);

    useEffect(() => {
        if (!initialUser) {
            window.location.href = "/unauthorized";
        }
    }, [initialUser]);

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

    async function handleEditCollection() {
        if (!collection) return;
        setSavingEdit(true);
        try {
            const updated = await updateCollection(collection.collectionId, {
                name: editName.trim() || "Untitled Collection",
                slug: collection.slug,
                description: editDescription.trim() || null,
            });
            setCollection(updated);
            setEditDialogOpen(false);
            toast.success("Collection updated.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to update collection.");
        } finally {
            setSavingEdit(false);
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

    if (!collection) {
        return null;
    }
    if (!initialUser) {
        return null;
    }
    if (collection.collectionId !== collectionId) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background px-[15px] pt-15 pb-20">

            <div className="z-[10] flex p-[10px] justify-end fixed top-0 left-0 w-full">
                <UserPopover user={initialUser} />
            </div>

            <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">

                <p className="text-sm text-muted-foreground"><a href={`/dashboard/${projectId}`} className="transition-all duration-300 hover:text-foreground">Project</a> / {collection.name}</p>

                <Tabs value={activeTab} onValueChange={(value) => {
                    const nextTab = collectionTabs.includes(value as CollectionTab)
                        ? (value as CollectionTab)
                        : "papers";
                    setActiveTab(nextTab);
                    writeTabToQuery(nextTab);
                }}>
                    <TabsList>
                        <TabsTrigger value="papers">Papers</TabsTrigger>
                        <TabsTrigger value="settings">Settings</TabsTrigger>
                    </TabsList>

                    <TabsContent value="papers" className="mt-10">
                        <div className="space-y-8">

                            {pages && pages.length === 0 && (
                                <div className="flex flex-col items-center">
                                    <EmptyPaperNotes height={180} width={180} />
                                    <Label>No pages created</Label>
                                    <Button loading={creatingPage} onClick={() => { handleCreatePage() }} className="mt-5"><PlusIcon /> Create Page</Button>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">

                                {pages && pages.length > 0 &&
                                    <div className="flex flex-col items-center select-none cursor-pointer" onClick={() => {
                                        if (creatingPage) return;
                                        handleCreatePage()
                                    }} >
                                        <EmptyPaperNotes />
                                        <p className="text-sm">Create page</p>
                                    </div>
                                }

                                {pages.map((page) => (
                                    <PaperCardComponent
                                        key={page.paperId}
                                        handle={initialUser?.username ?? "user"}
                                        paperData={page}
                                        onDeleted={(paperId) => setPages((prev) => prev.filter((p) => p.paperId !== paperId))}
                                    />
                                ))}

                            </div>

                        </div>
                    </TabsContent>

                    <TabsContent value="settings">
                        <div className="space-y-8 mt-10">
                            <section className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-semibold">Collection Details</h3>
                                        <p className="mt-2 text-sm text-muted-foreground">Name: {collection.name}</p>
                                        {collection.description && <p className="text-sm text-muted-foreground">Description: {collection.description}</p>}
                                    </div>
                                    <Button variant="secondary" onClick={() => setEditDialogOpen(true)}>
                                        Edit
                                    </Button>
                                </div>
                            </section>

                            <section className="space-y-4">
                                <h3 className="text-base font-semibold">Status</h3>
                                <div className="flex items-center justify-between max-w-[320px]">
                                    <p className={`text-sm flex gap-1 items-center ${collection.isPublic ? "text-primary" : "text-muted-foreground"}`}>
                                        {collection.isPublic ? <RssIcon size={14} /> : <LockIcon size={14} />}
                                        {collection.isPublic ? "Public" : "Draft"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant={collection.isPublic ? "ghost" : "outline"}
                                            onClick={() => { void handleCollectionVisibilityChange(false); }}
                                            disabled={updatingCollectionVisibility}
                                        >
                                            <LockIcon size={14} className="mr-1" />
                                            Draft
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={collection.isPublic ? "outline" : "ghost"}
                                            onClick={() => { void handleCollectionVisibilityChange(true); }}
                                            disabled={updatingCollectionVisibility}
                                            loading={updatingCollectionVisibility}
                                        >
                                            <RssIcon size={14} className="mr-1" />
                                            Public
                                        </Button>
                                    </div>
                                </div>
                            </section>

                            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle>Edit Collection</DialogTitle>
                                        <DialogDescription>Update collection name and description.</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-1">
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-collection-name">Name</Label>
                                            <Input
                                                id="edit-collection-name"
                                                value={editName}
                                                onChange={(event) => setEditName(event.target.value)}
                                                maxLength={120}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="edit-collection-description">Description</Label>
                                            <Input
                                                id="edit-collection-description"
                                                value={editDescription}
                                                onChange={(event) => setEditDescription(event.target.value)}
                                                maxLength={1000}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="secondary" onClick={() => setEditDialogOpen(false)} disabled={savingEdit}>
                                            Cancel
                                        </Button>
                                        <Button type="button" onClick={handleEditCollection} loading={savingEdit}>
                                            Save
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <section className="space-y-3">
                                <h3 className="text-base font-semibold text-destructive">Danger zone</h3>
                                <p className="text-sm text-muted-foreground">Delete this collection and all its pages permanently.</p>

                                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                                    <div>
                                        <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                                            Delete collection
                                        </Button>
                                    </div>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Delete collection?</DialogTitle>
                                            <DialogDescription>This will delete this collection <span className="text-[15px] font-[500]">{collection.name}</span> and all its pages</DialogDescription>
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
                            </section>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
