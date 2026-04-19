import type { PaperDoc } from "@/lib/types";
import { formatFirestoreDate } from "@/lib/utils";
import abstractLightPic from "@/assets/abstract_light.jpg";
import abstractDarkPic from "@/assets/abstract_dark.jpg";

export default function BlogCard({
    blogData,
    showDesc = true,
    basePath = "/blogs"
}: {
    blogData: PaperDoc,
    showDesc?: boolean,
    basePath?: string
}) {
    return (
        <a href={`${basePath}/${blogData.slug}`} className="relative flex flex-col" data-astro-prefetch="viewport">
            <div className="overflow-hidden aspect-5/3">
                {
                    blogData.thumbnailUrl ?
                        <img alt={`Cover image for ${blogData.title}`} className="w-full object-cover w-full h-full border rounded-[3px]" src={blogData.thumbnailUrl} />
                        :
                        <>
                            <img className="dark:hidden w-full object-cover border w-full h-full opacity-[0.7] rounded-[3px]" src={abstractLightPic.src} alt={`Abstract light cover image for ${blogData.title}`} />
                            <img className="hidden dark:block w-full object-cover w-full h-full border opacity-[0.4] rounded-[3px]" src={abstractDarkPic.src} alt={`Abstract dark cover image for ${blogData.title}`} />
                        </>
                }
            </div>
            <p className="mt-4 text-[20px] font-[500] line-clamp-2">{blogData.title}</p>
            {showDesc &&
                <p className="mt-1 text-[15px] text-muted-foreground mb-auto">{blogData.metadata?.metaDescription}</p>
            }
            <p className="text-[14px] md:text-[12px] text-muted-foreground mt-3" > {formatFirestoreDate(blogData.createdAt)}</p>
        </a>
    )
}