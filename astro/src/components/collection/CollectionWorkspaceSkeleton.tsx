import { Skeleton } from "@/components/ui/skeleton";

function UserPopoverSkeleton() {
  return <Skeleton className="h-9 w-9 rounded-full" />;
}

function BreadcrumbSkeleton() {
  return <Skeleton className="h-4 w-40" />;
}

function EditButtonSkeleton() {
  return <Skeleton className="h-9 w-20" />;
}

function CollectionIdFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center gap-4 justify-between">
        <Skeleton className="h-5 w-48 font-mono" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

function FormFieldSkeleton({ labelWidth = "w-32", inputWidth = "md:w-[300px] w-full" }: { labelWidth?: string; inputWidth?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={`h-4 ${labelWidth}`} />
      <Skeleton className={`h-9 ${inputWidth}`} />
    </div>
  );
}

function StatusButtonSkeleton() {
  return <Skeleton className="h-9 w-[100px]" />;
}

function DescriptionSkeleton() {
  return (
    <div className="space-y-4 mt-15">
      <Skeleton className="h-4 w-36" />
      <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground h-[250px]">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

function CreatePageCardSkeleton() {
  return (
    <div className="flex flex-col items-center cursor-pointer">
      <Skeleton className="md:w-[180px] md:h-[180px] w-[120px] h-[120px] rounded-lg" />
      <Skeleton className="h-4 w-20 mt-2" />
    </div>
  );
}

function PageCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border">
      <Skeleton className="aspect-[5/3] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-[60%]" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export default function CollectionWorkspaceSkeleton() {
  return (
    <div className="min-h-screen bg-background px-[15px] pt-15 pb-20">
      <div className="z-[10] fixed top-4 right-4">
        <UserPopoverSkeleton />
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
        <div>
          <BreadcrumbSkeleton />
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          <div className="space-y-6 md:flex-2">
            <div className="flex items-center gap-2 justify-end w-full">
              <EditButtonSkeleton />
            </div>

            <div className="flex md:flex-row flex-col md:gap-10 gap-6">
              <div className="flex flex-col gap-5 w-full">
                <CollectionIdFieldSkeleton />
                <FormFieldSkeleton labelWidth="w-32" />
                <FormFieldSkeleton labelWidth="w-28" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex items-center justify-between gap-2 mt-2 w-full">
                    <StatusButtonSkeleton />
                    <Skeleton className="h-9 w-9 rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            <DescriptionSkeleton />
          </div>

          <div className="space-y-12 md:flex-2">
            <div className="space-y-5">
              <Skeleton className="h-5 w-16" />
              <div className="grid grid-cols-2 gap-5">
                <CreatePageCardSkeleton />
                <PageCardSkeleton />
                <PageCardSkeleton />
                <PageCardSkeleton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
