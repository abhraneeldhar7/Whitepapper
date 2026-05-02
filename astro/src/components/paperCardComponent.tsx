import type { PaperDoc } from "@/lib/entities";
import { formatFirestoreDate } from "@/lib/utils";
import { NotebookPen, RssIcon } from "lucide-react";
import abstractLightPic from "@/assets/abstract_light.jpg";
import abstractDarkPic from "@/assets/abstract_dark.jpg";

export default function PaperCardComponent({
    handle,
    paperData,
    onSelect,
    showStatus = false,
}: {
    handle?: string;
    paperData: PaperDoc;
    onSelect?: (paper: PaperDoc) => void;
    showStatus?: boolean;
}) {
    const statusLabel =
        paperData.status === "draft" ? "Draft" : "Public";
    const statusClassName =
        paperData.status === "draft"
            ? "border-amber-200 bg-amber-100 text-amber-800"
            : "border-emerald-200 bg-emerald-100 text-emerald-800";
    const StatusIcon = paperData.status === "draft" ? NotebookPen : RssIcon;

    const cardBody = (
        <>
            {showStatus && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-[8px] py-[5px] text-[10px] leading-[11px] font-[420] w-fit ${statusClassName} absolute top-[8px] right-[7px]`}>
                    <StatusIcon size={10} /> {statusLabel}
                </span>
            )}

            <div className="overflow-hidden aspect-5/3">
                {
                    paperData.thumbnailUrl ?
                        <img
                            className="w-full object-cover w-full h-full border rounded-[3px]"
                            src={paperData.thumbnailUrl}
                            alt={`Cover image for ${paperData.title}`}
                            width={640}
                            height={360}
                            loading="lazy"
                            decoding="async"
                        />
                        :
                        <>
                            <img
                                className="dark:hidden w-full object-cover border w-full h-full opacity-[0.7] rounded-[3px]"
                                src={abstractLightPic.src}
                                alt={`Abstract placeholder cover for ${paperData.title}`}
                                width={640}
                                height={360}
                                loading="lazy"
                                decoding="async"
                            />
                            <img
                                className="hidden dark:block w-full object-cover w-full h-full border opacity-[0.4] rounded-[3px]"
                                src={abstractDarkPic.src}
                                alt={`Abstract placeholder cover for ${paperData.title}`}
                                width={640}
                                height={360}
                                loading="lazy"
                                decoding="async"
                            />
                        </>
                }
            </div>
            <p className="mt-2 text-[16px] line-clamp-2">{paperData.title}</p>
        </>
    );

    return (<div className="flex flex-col relative justify-between">
        {onSelect ? (
            <button
                
                onClick={() => onSelect(paperData)}
                className="relative text-left"
            >
                {cardBody}
            </button>
        ) : handle ? (
            <a href={paperData.status == "public" ? `/${handle}/${paperData.slug}` : `/write/${paperData.paperId}`} target={paperData.status == "public" ? "_blank" : ""} className="relative">
                {cardBody}
            </a>
        ) : (
            <div className="relative opacity-70 pointer-events-none">
              {cardBody}
            </div>
        )}



        <div className="flex justify-between">
            <p className="text-[14px] md:text-[12px] text-muted-foreground mt-1" > {formatFirestoreDate(paperData.createdAt)}</p>
        </div>
    </div>)
}

