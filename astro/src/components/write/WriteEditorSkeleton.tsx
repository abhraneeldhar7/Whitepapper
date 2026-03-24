import { Skeleton } from "@/components/ui/skeleton";

export default function WriteEditorSkeleton() {
  return (
    <div className="write-editor-skeleton min-h-screen flex flex-col max-w-[700px] mx-auto px-[15px] pb-8 pt-14 relative">
      <div className="fixed top-0 left-0 w-full px-[10px] py-[4px] backdrop-blur-[30px] z-[10] bg-background/20 flex items-center justify-between">
        <Skeleton className="h-8 w-8" />
        <div className="flex gap-[5px] items-center">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-[80px]" />
        </div>
      </div>

      <div className="bg-card rounded-lg overflow-hidden flex items-center justify-center relative border mt-1 h-[300px]">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>

      <div className="mt-4 flex flex-col gap-2 flex-1">
        <Skeleton className="h-12 w-[70%]" />
        <div className="mt-2 space-y-3">
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-[88%]" />
          <Skeleton className="h-4 w-[80%]" />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-[140px]" />
        </div>
      </div>
    </div>
  );
}
