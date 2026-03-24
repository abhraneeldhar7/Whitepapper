import { useState } from "react";
import PaperCardComponent from "@/components/paperCardComponent";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicCollectionBySlug } from "@/lib/api/public";
import type { CollectionDoc, PaperDoc } from "@/lib/types";

type ProjectCollectionsViewerProps = {
  handle: string;
  projectSlug: string;
  collections: CollectionDoc[];
};

type CollectionState = {
  loading: boolean;
  loaded: boolean;
  papers: PaperDoc[];
};

export default function ProjectCollectionsViewer({
  handle,
  projectSlug,
  collections,
}: ProjectCollectionsViewerProps) {
  const [collectionStates, setCollectionStates] = useState<Record<string, CollectionState>>({});

  async function handleCollectionOpen(collection: CollectionDoc) {
    const cached = collectionStates[collection.collectionId];
    if (cached?.loaded || cached?.loading) {
      return;
    }

    setCollectionStates((prev) => ({
      ...prev,
      [collection.collectionId]: {
        loading: true,
        loaded: false,
        papers: [],
      },
    }));

    try {
      const data = await getPublicCollectionBySlug(handle, projectSlug, collection.slug);
      const sorted = [...data.papers].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
      setCollectionStates((prev) => ({
        ...prev,
        [collection.collectionId]: {
          loading: false,
          loaded: true,
          papers: sorted,
        },
      }));
    } catch {
      setCollectionStates((prev) => ({
        ...prev,
        [collection.collectionId]: {
          loading: false,
          loaded: true,
          papers: [],
        },
      }));
    }
  }

  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <Label>Collections</Label>

      <Accordion type="multiple" className="w-full">
        {collections.map((collection) => {
          const state = collectionStates[collection.collectionId];
          const isLoading = state?.loading;
          const papersForCollection = state?.papers || [];

          return (
            <AccordionItem key={collection.collectionId} value={collection.collectionId}>
              <AccordionTrigger
                onClick={() => {
                  void handleCollectionOpen(collection);
                }}
              >
                {collection.name}
              </AccordionTrigger>
              <AccordionContent>
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-5 pt-2 md:grid-cols-3">
                    <Skeleton className="h-[185px] rounded-md" />
                    <Skeleton className="h-[185px] rounded-md" />
                    <Skeleton className="hidden h-[185px] rounded-md md:block" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5 pt-2 md:grid-cols-3">
                    {papersForCollection.map((paper) => (
                      <PaperCardComponent
                        key={paper.paperId}
                        handle={handle}
                        paperData={paper}
                      />
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
