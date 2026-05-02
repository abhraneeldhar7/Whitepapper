import type { CollectionDoc, PaperDoc } from "@/lib/entities";
import { Label } from "../ui/label";
import PaperCardComponent from "../paperCardComponent";

type Props = {
  handle: string;
  collections: CollectionDoc[];
  papers: PaperDoc[];
};

export default function ProjectCollectionsViewer({ handle, collections, papers }: Props) {
  return (
    <div className="space-y-10">
      {collections.map((collection) => {
        const collectionPapers = papers.filter((p) => p.collectionId === collection.collectionId);
        return (
          <div key={collection.collectionId} className="space-y-4">
            <Label>{collection.name}</Label>
            {collectionPapers.length > 0 ? (
              <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
                {collectionPapers.map((paper) => (
                  <PaperCardComponent key={paper.paperId} handle={handle} paperData={paper} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No papers in this collection.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
