import { LockIcon } from "lucide-react";
import type { ProjectDoc } from "@/lib/types";
import FolderNotes from "@/components/folderComponent";

type ProjectCardProps = {
    project: ProjectDoc;
    href: string;
    showLockIcon?: boolean;
};

export default function ProjectCard({
    project,
    href,
    showLockIcon = true,
}: ProjectCardProps) {
    return (
        <div className="flex flex-col items-center">
            <a href={href}>
                <div className="relative inline-flex">
                    <FolderNotes logoUrl={project.logoUrl} />
                    
                    {showLockIcon && !project.isPublic ? (
                        <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border bg-background">
                            <LockIcon size={12} />
                        </span>
                    ) : null}
                </div>
            </a>
            <p className="text-sm ">{project.name}</p>
            <p className="mt-2 text-xs text-muted-foreground">{project.pagesNumber} pages</p>
        </div>
    );
}