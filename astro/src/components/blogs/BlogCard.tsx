import type { PaperDoc } from "@/lib/types";
import { formatFirestoreDate } from "@/lib/utils";
import abstractLightPic from "@/assets/abstract_light.jpg";
import abstractDarkPic from "@/assets/abstract_dark.jpg";

export default function BlogCard({
    blogData
}: {
    blogData: PaperDoc
}) {
    return (
        <a href={`/blogs/${blogData.slug}`} className="relative flex flex-col">
            <div className="overflow-hidden aspect-3/4">
                {
                    blogData.thumbnailUrl ?
                        <img className="w-full object-cover w-full h-full border rounded-[3px]" src={blogData.thumbnailUrl} />
                        :
                        <>
                            <img className="dark:hidden w-full object-cover border w-full h-full opacity-[0.7] rounded-[3px]" src={abstractLightPic.src} />
                            <img className="hidden dark:block w-full object-cover w-full h-full border opacity-[0.4] rounded-[3px]" src={abstractDarkPic.src} />
                        </>
                }
            </div>
            <p className="mt-2 text-[16px] line-clamp-2">{blogData.title}</p>
            <p className="text-[14px] md:text-[12px] text-muted-foreground mt-1" > {formatFirestoreDate(blogData.createdAt)}</p>
        </a>
    )
}