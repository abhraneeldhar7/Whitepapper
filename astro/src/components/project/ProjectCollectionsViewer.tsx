import PaperCardComponent from "@/components/paperCardComponent";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import type { CollectionDoc, PaperDoc, PublicProjectCollectionPapers } from "@/lib/types";

type ProjectCollectionsViewerProps = {
  handle: string;
  collections: CollectionDoc[];
  collectionPapers?: PublicProjectCollectionPapers[];
};

export default function ProjectCollectionsViewer({
  handle,
  collections,
  collectionPapers = [],
}: ProjectCollectionsViewerProps) {
  const papersByCollection = new Map<string, PaperDoc[]>(
    collectionPapers.map((entry) => [entry.collectionId, entry.papers || []]),
  );

  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Label>Collections</Label>

      <Accordion type="multiple" className="w-full">
        {collections.map((collection) => {
          const papersForCollection = papersByCollection.get(collection.collectionId) || [];

          return (
            <AccordionItem key={collection.collectionId} value={collection.collectionId}>
              <AccordionTrigger>
                {collection.name}
              </AccordionTrigger>
              <AccordionContent className="h-auto overflow-visible">
                <div className="grid grid-cols-2 gap-5 pt-2 md:grid-cols-3">
                  {papersForCollection.map((paper) => (
                    <PaperCardComponent
                      key={paper.paperId}
                      handle={handle}
                      paperData={paper}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
