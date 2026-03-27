import { LockIcon } from "lucide-react";
import type { CollectionDoc, ProjectDoc } from "@/lib/types";
import FolderNotes from "@/components/folderComponent";

type ProjectCardProps = {
    project: ProjectDoc | CollectionDoc;
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
                    <FolderNotes />

                    {showLockIcon && !project.isPublic ? (
                        <span className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 z-2">
                            <LockIcon size={22} strokeWidth={3} className="text-destructive" />
                        </span>
                    ) : null}
                </div>
            </a>
            <p className="text-sm ">{project.name}</p>
            <p className="mt-2 text-xs text-muted-foreground">{project.pagesNumber} pages</p>
        </div>
    );
}