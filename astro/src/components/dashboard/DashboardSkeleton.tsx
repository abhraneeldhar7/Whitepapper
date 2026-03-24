import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardSkeleton() {
  return (
    <div className="dashboard-shell-skeleton min-h-screen bg-background px-[15px] pt-5 pb-20 md:pt-8">
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
        <div className="fixed top-0 left-0 flex w-full justify-end p-[10px]">
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>

        <Skeleton className="h-4 w-24" />

        <div className="space-y-8">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-18" />
          </div>

          <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
            <Skeleton className="min-h-36 rounded-xl" />
            <Skeleton className="min-h-36 rounded-xl" />
            <Skeleton className="min-h-36 rounded-xl" />
            <Skeleton className="min-h-36 rounded-xl" />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between md:justify-start md:gap-5">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-9 w-24" />
            </div>

            <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
