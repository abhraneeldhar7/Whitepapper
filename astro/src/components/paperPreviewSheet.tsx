import { DownloadIcon, Ellipsis, ForwardIcon, NotebookPen, SquareArrowOutUpRight, Trash2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import PostRender from "@/components/ui/markdown-render/markdown-render";
import { deletePaper } from "@/lib/api/papers";
import { resolveIntegrationBaseUrl } from "@/lib/integrationBaseUrl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import type { PaperDoc } from "@/lib/entities";
import { copyToClipboardWithToast, downloadMarkdownFile } from "@/lib/utils";

type PaperPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paper: PaperDoc | null;
  handle?: string;
  isMobileUA: boolean;
  onPaperDeleted?: (paperId: string) => void;
};

export default function PaperPreviewSheet({
  open,
  onOpenChange,
  paper,
  handle,
  isMobileUA,
  onPaperDeleted,
}: PaperPreviewSheetProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!paper) {
    return null;
  }

  const isMobile = isMobileUA;

  const resolvePublicUrl = (): string => {
    const baseUrl = resolveIntegrationBaseUrl();
    const origin =
      baseUrl || (typeof window !== "undefined" ? String(window.location.origin || "").trim().replace(/\/+$/, "") : "");
    const safeHandle = String(handle || "").trim();
    const safeSlug = String(paper.slug || "").trim();
    return `${origin}/${safeHandle}/${safeSlug}`;
  };

  const handleShare = async () => {
    if (!String(handle || "").trim() || !String(paper.slug || "").trim()) {
      toast.error("Unable to resolve public URL.");
      return;
    }
    const publicUrl = resolvePublicUrl();
    if (!publicUrl) {
      toast.error("Unable to resolve public URL.");
      return;
    }
    await copyToClipboardWithToast(publicUrl, "Public URL copied.", "Unable to copy public URL.");
    setActionsOpen(false);
  };

  const handleDownload = () => {
    downloadMarkdownFile(paper.body || "", paper.slug || "page");
    setActionsOpen(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePaper(paper.paperId);
      toast.success("Page deleted.");
      onPaperDeleted?.(paper.paperId);
      onOpenChange(false);
      setDeleteDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete page.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        side={isMobile ? "bottom" : "right"}
        className="md:m-2 border-[2px] rounded-[8px] gap-0 p-0 data-[side=bottom]:h-[80vh] data-[side=bottom]:w-full data-[side=right]:w-full md:data-[side=right]:w-[500px] data-[side=right]:sm:max-w-[500px]"
      >
        <div className="flex items-center justify-between border-b p-[6px]">
          <div className="flex items-center gap-2">
            <a href={`/write/${paper.paperId}`}>
              <Button size="sm">
                <NotebookPen /> Edit
              </Button>
            </a>
            {paper.status === "public" ? (
              <a href={`/${handle || "user"}/${paper.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <SquareArrowOutUpRight /> Open
                </Button>
              </a>
            ) : null}
            <Popover open={actionsOpen} onOpenChange={setActionsOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <Ellipsis />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[170px] p-[4px]" align="start">
                <div className="flex flex-col gap-[4px]">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={() => {
                      void handleShare();
                    }}
                  >
                    <ForwardIcon /> Share
                  </Button>
                  <Button variant="ghost" size="sm" className="justify-start" onClick={handleDownload}>
                    <DownloadIcon /> Download
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-destructive hover:text-destructive"
                    onClick={() => {
                      setActionsOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2Icon /> Delete
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <SheetClose asChild>
            <Button className="mr-1" variant="ghost" size="icon" aria-label="Close preview">
              <XIcon />
            </Button>
          </SheetClose>
        </div>

        <ScrollArea className="h-[calc(90vh-58px)] md:h-[calc(100vh-58px)]">
          <div className="px-4 pt-4 pb-10">
            <h1 className="text-[28px] font-[600]" style={{ lineHeight: "1.4em" }}>
              {paper.title}
            </h1>

            {paper.thumbnailUrl ? (
              <figure className="mt-6 overflow-hidden rounded-[8px] border">
                <img
                  src={paper.thumbnailUrl}
                  alt={paper.title}
                  className="h-full w-full object-cover aspect-5/3 object-center"
                />
              </figure>
            ) : null}

            <section className="mt-6" aria-label="Article content">
              <PostRender content={paper.body || ""} />
            </section>
          </div>
        </ScrollArea>
      </SheetContent>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete page?</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-[500]">{paper.title || "this page"}</span>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => { void handleDelete(); }} loading={deleting}>
              Confirm delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}

