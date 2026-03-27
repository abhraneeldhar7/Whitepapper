import PaperCardComponent from "@/components/paperCardComponent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PaperDoc, ProjectDoc, UserDoc } from "@/lib/types";
import ProjectDescriptionViewer from "./ProjectDescriptionViewer";
import ProjectCollectionsViewer from "./ProjectCollectionsViewer";

type PublicProjectPageProps = {
  handle: string;
  project: ProjectDoc;
  papers: PaperDoc[];
  collections: any[];
  owner?: UserDoc | null;
  projectCreatedDate?: string | null;
  currentUserId?: string | null;
};

export default function PublicProjectPage({
  handle,
  project,
  papers,
  collections,
  owner,
  projectCreatedDate,
  currentUserId,
}: PublicProjectPageProps) {
  const canManageProject = Boolean(currentUserId && currentUserId === project.ownerId);

  const standalonePapers = papers.filter((paper) => !paper.collectionId);
  const sortedStandalonePapers = [...standalonePapers].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1400px] px-[15px] pt-8 pb-20">
      <div className="flex flex-col gap-10 md:gap-20 md:flex-row">
        <div className="space-y-4 md:flex-3">
          <div className="flex flex-wrap gap-5 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-md border">
                {project.logoUrl ? (
                  <img src={project.logoUrl} alt={project.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[20px] font-semibold text-muted-foreground">
                    {project.name.slice(0, 1).toUpperCase() || "P"}
                  </div>
                )}
              </div>
              <h1 className="text-[26px] font-semibold leading-tight">{project.name}</h1>
            </div>
            {canManageProject && (
              <a href={`/dashboard/${project.projectId}`}>
                <Button type="button">Open dashboard</Button>
              </a>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            {owner && (
              <a
                href={`/${owner.username}`}
                className="flex items-center gap-[8px] w-fit"
              >
                <div className="h-[28px] w-[28px] p-[1px] bg-[white] dark:bg-[black] rounded-[8px] border shadow-md">
                  <img
                    src={owner.avatarUrl||""}
                    className="rounded-[6px] h-full w-full object-cover"
                    alt={owner.displayName ?? owner.username}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <p className="text-[14px] text-muted-foreground">
                  {owner.displayName}
                </p>
              </a>
            )}

            {projectCreatedDate && (
              <p className="text-[14px] text-muted-foreground">{projectCreatedDate}</p>
            )}
          </div>

          <ProjectDescriptionViewer content={project.description || ""} />
        </div>

        <div className="space-y-8 md:flex-3">
          <div className="space-y-4">
            <Label>Papers</Label>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
              {sortedStandalonePapers.map((paper) => (
                <PaperCardComponent
                  key={paper.paperId}
                  handle={handle}
                  paperData={paper}
                />
              ))}
            </div>
          </div>

          <ProjectCollectionsViewer
            handle={handle}
            collections={collections}
          />
        </div>
      </div>
    </main>
  );
}
