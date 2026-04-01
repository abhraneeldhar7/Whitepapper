import { NotebookPen, SquareArrowOutUpRight, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import PostRender from "@/components/pre_made_components/render/postPreview";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import type { PaperDoc } from "@/lib/types";

type PaperPreviewSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paper: PaperDoc | null;
  handle: string;
};

export default function PaperPreviewSheet({
  open,
  onOpenChange,
  paper,
  handle,
}: PaperPreviewSheetProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    setIsMobile(media.matches);
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleMediaChange);
      return () => media.removeEventListener("change", handleMediaChange);
    }

    media.addListener(handleMediaChange);
    return () => media.removeListener(handleMediaChange);
  }, []);

  if (!paper) {
    return null;
  }

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
            {paper.status === "published" ? (
              <a href={`/${handle}/${paper.slug}`} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm">
                  <SquareArrowOutUpRight /> Open
                </Button>
              </a>
            ) : null}
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
                  className="h-full w-full object-contain"
                />
              </figure>
            ) : null}

            <section className="mt-6" aria-label="Article content">
              <PostRender content={paper.body || ""} />
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
