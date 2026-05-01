import { Skeleton } from "@/components/ui/skeleton";

function UserPopoverSkeleton() {
  return <Skeleton className="h-9 w-9 rounded-full" />;
}

function BreadcrumbSkeleton() {
  return <Skeleton className="h-4 w-48" />;
}

function TabsSkeleton() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-9 w-24" />
      <Skeleton className="h-9 w-14" />
      <Skeleton className="h-9 w-14" />
    </div>
  );
}

function EditButtonSkeleton() {
  return <Skeleton className="h-9 w-20" />;
}

function ProjectLogoSkeleton() {
  return <Skeleton className="h-[90px] w-[90px] rounded-lg" />;
}

function FormFieldSkeleton({ labelWidth = "w-24", inputWidth = "md:w-[300px] w-full" }: { labelWidth?: string; inputWidth?: string }) {
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

function CreateCollectionCardSkeleton() {
  return (
    <div className="flex flex-col items-center">
      <Skeleton className="h-24 w-24 rounded-lg opacity-50" />
      <Skeleton className="h-4 w-32 mt-2" />
    </div>
  );
}

function CollectionCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border">
      <Skeleton className="aspect-[5/3] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-[80%]" />
        <Skeleton className="h-3 w-[50%]" />
      </div>
    </div>
  );
}

function ApiTabSkeleton() {
  return (
    <div className="space-y-6 max-w-[800px] w-full mx-auto">
      <div className="space-y-4">
        <div className="grid gap-3 text-sm">
          <div className="flex items-start gap-4">
            <Skeleton className="h-4 w-[90px]" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-[90px]" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-[90px]" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-[200px] w-full rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[75%]" />
          <Skeleton className="h-4 w-[80%]" />
        </div>
      </div>
    </div>
  );
}

function McpTabSkeleton() {
  return (
    <div className="space-y-6 max-w-[800px] w-full mx-auto">
      <div className="space-y-4">
        <Skeleton className="h-5 w-32" />
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          <Skeleton className="h-4 w-48" />
          <div className="flex mt-2">
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProjectWorkspaceSkeleton() {
  return (
    <div className="min-h-screen px-[15px] pt-15 pb-20">
      <div className="z-[10] fixed top-4 right-4">
        <UserPopoverSkeleton />
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
        <div>
          <BreadcrumbSkeleton />
        </div>

        <TabsSkeleton />

        <div className="flex flex-col gap-8 md:flex-row">
          <div className="space-y-6 md:flex-2">
            <div className="flex items-center gap-2 justify-end w-full">
              <EditButtonSkeleton />
            </div>

            <div className="flex md:flex-row flex-col md:gap-10 gap-6">
              <div>
                <Skeleton className="h-4 w-24 mb-3" />
                <ProjectLogoSkeleton />
              </div>

              <div className="flex flex-col gap-5 w-full">
                <FormFieldSkeleton labelWidth="w-28" />
                <FormFieldSkeleton labelWidth="w-24" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-16" />
                  <div className="flex items-center gap-2 mt-2">
                    <StatusButtonSkeleton />
                    <Skeleton className="h-9 w-16" />
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

            <div className="space-y-5">
              <Skeleton className="h-5 w-24" />
              <div className="grid grid-cols-2 gap-5">
                <CreateCollectionCardSkeleton />
                <CollectionCardSkeleton />
                <CollectionCardSkeleton />
                <CollectionCardSkeleton />
              </div>
            </div>
          </div>
        </div>

        <ApiTabSkeleton />
        <McpTabSkeleton />
      </div>
    </div>
  );
}
