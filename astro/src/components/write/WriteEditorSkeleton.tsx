import { Skeleton } from "@/components/ui/skeleton";

export default function WriteEditorSkeleton() {
  return (
    <div className="min-h-screen flex flex-col max-w-[700px] mx-auto px-[15px] pb-8 pt-14 relative">
      <div
        className="fixed top-0 left-0 w-full z-[10] md:pb-8 md:bg-[unset] bg-background/20 md:backdrop-blur-[0px] backdrop-blur-[30px]"
      >
        <div className="px-[10px] py-[5px] flex items-center justify-between">
          <Skeleton className="h-7 w-7" />
          <div className="flex gap-[5px] items-center">
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-9" />
            <Skeleton className="h-9 w-[80px]" />
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg overflow-hidden flex items-center justify-center relative border mt-1 h-[300px]">
        <div className="flex flex-col items-center justify-center gap-2">
          <Skeleton className="h-9 w-9 opacity-50" />
          <Skeleton className="h-4 w-24 opacity-50" />
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 flex-1">
        <Skeleton className="h-12 w-full" />

        <div className="mt-2 space-y-3">
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[92%]" />
          <Skeleton className="h-4 w-[88%]" />
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[85%]" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[75%]" />
        </div>
      </div>
    </div>
  );
}
