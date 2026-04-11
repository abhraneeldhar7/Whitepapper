import PaperCardComponent from "@/components/paperCardComponent";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import type { CollectionDoc, PaperDoc } from "@/lib/types";
import { ChevronRight } from "lucide-react";

type ProjectCollectionsViewerProps = {
  handle: string;
  collections: CollectionDoc[];
  papers?: PaperDoc[];
};

export default function ProjectCollectionsViewer({
  handle,
  collections,
  papers = [],
}: ProjectCollectionsViewerProps) {
  const papersByCollection = new Map<string, PaperDoc[]>();
  for (const paper of papers) {
    const collectionId = paper.collectionId;
    if (!collectionId) {
      continue;
    }
    const current = papersByCollection.get(collectionId) || [];
    current.push(paper);
    papersByCollection.set(collectionId, current);
  }

  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label>Collections</Label>

      <Accordion type="multiple" className="w-full">
        {collections.map((collection) => {
          const papersForCollection = [...(papersByCollection.get(collection.collectionId) || [])].sort(
            (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
          );

          return (
            <AccordionItem key={collection.collectionId} value={collection.collectionId}>
              <AccordionTrigger>
                <div className="flex items-center gap-1 leading-[1em]">
                <ChevronRight size={15}/>
                {collection.name}
                </div>
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
