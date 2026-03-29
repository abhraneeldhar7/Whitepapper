import { useState } from "react";
import type { PaperDoc } from "@/lib/types";
import { formatFirestoreDate } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Archive, Ellipsis, NotebookPen, RssIcon, SquareArrowOutUpRightIcon, Trash2Icon } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { deletePaper } from "@/lib/api/papers";
import { toast } from "sonner";
import abstractLightPic from "@/assets/abstract_light.jpg";
import abstractDarkPic from "@/assets/abstract_dark.jpg";

export default function PaperCardComponent({
    handle,
    paperData,
    onDeleted,
    showStatus = false,
}: {
    handle: string;
    paperData: PaperDoc;
    onDeleted?: (paperId: string) => void;
    showStatus?: boolean;
}) {
    const [deleting, setDeleting] = useState(false);
    const statusLabel =
        paperData.status === "draft"
            ? "Draft"
            : paperData.status === "published"
                ? "Published"
                : "Archived";
    const statusClassName =
        paperData.status === "draft"
            ? "border-amber-200 bg-amber-100 text-amber-800"
            : paperData.status === "published"
                ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                : "border-zinc-200 bg-zinc-100 text-zinc-700";
    const StatusIcon =
        paperData.status === "draft"
            ? NotebookPen
            : paperData.status === "published"
                ? RssIcon
                : Archive;

    function handleDeletePaper() {
        if (deleting) {
            return;
        }

        setDeleting(true);
        onDeleted?.(paperData.paperId);

        void deletePaper(paperData.paperId)
            .then(() => {
                toast.info("Paper deleted.");
            })
            .catch((error) => {
                toast.error(error instanceof Error ? error.message : "Failed to delete paper.");
            });
    }

    return (<div className="flex flex-col relative justify-between">
        <a href={paperData.status == "published" ? `/${handle}/${paperData.slug}` : `/write/${paperData.paperId}`} target={paperData.status == "published" ? "_blank" : ""} className="relative">
            {showStatus && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-[8px] py-[5px] text-[10px] leading-[11px] font-[420] w-fit ${statusClassName} absolute top-[8px] right-[7px]`}>
                    <StatusIcon size={10} /> {statusLabel}
                </span>
            )}

            <div className="overflow-hidden md:h-[170px] h-[125px]">
                {
                    paperData.thumbnailUrl ?
                        <img className="w-full object-cover w-full h-full border rounded-[3px]" src={paperData.thumbnailUrl} />
                        :
                        <>
                            <img className="dark:hidden w-full object-cover border w-full h-full opacity-[0.7] rounded-[3px]" src={abstractLightPic.src} />
                            <img className="hidden dark:block w-full object-cover w-full h-full border opacity-[0.4] rounded-[3px]" src={abstractDarkPic.src} />
                        </>
                }
            </div>
            <p className="mt-2 text-[16px] line-clamp-2">{paperData.title}</p>
        </a>



        <div className="flex justify-between">
            <p className="text-[14px] md:text-[12px] text-muted-foreground mt-1" > {formatFirestoreDate(paperData.createdAt)}</p>
            {onDeleted && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button size="icon" variant="ghost">
                            <Ellipsis />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-[2px] flex-col gap-[2px] flex">
                        {paperData.status == "published" ?
                            <a href={`/${handle}/${paperData.slug}`} target="_blank" className="w-full">
                                <Button size="sm" variant="ghost" className="w-full"><SquareArrowOutUpRightIcon size={18} /> Open</Button>
                            </a> :
                            <Button size="sm" variant="ghost" disabled><SquareArrowOutUpRightIcon size={18} /> Open</Button>

                        }
                        <a href={`/write/${paperData.paperId}`} className="w-full">
                            <Button size="sm" variant="ghost" className="w-full"><NotebookPen size={18} /> Edit</Button>
                        </a>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="destructive"><Trash2Icon /> Delete</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Delete this paper?</DialogTitle>
                                    <DialogDescription>{paperData.title}</DialogDescription>
                                </DialogHeader>
                                {paperData.thumbnailUrl &&
                                    <img src={paperData.thumbnailUrl} className="h-[200px] w-full rounded-[4px]" />
                                }
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary" disabled={deleting}>Cancel</Button>
                                    </DialogClose>
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={handleDeletePaper}
                                            loading={deleting}
                                            disabled={deleting}
                                        >
                                            <Trash2Icon /> Delete
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    </div>)
}