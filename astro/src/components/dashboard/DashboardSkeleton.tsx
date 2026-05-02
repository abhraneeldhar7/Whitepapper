import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import EmptyPaperNotes from "../emptyPagesComp";
import abstractLightPic from "@/assets/abstract_light.jpg";
import abstractDarkPic from "@/assets/abstract_dark.jpg";
import FolderNotes from "../folderComponent";
import { MAX_LANDING_PAGE_WIDTH } from "@/lib/design";

export default function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background px-5 md:px-15 pt-20">
      <div className="z-[10] flex p-[10px] justify-end fixed top-0 left-0 w-full">
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>

      <div className="mx-auto flex w-full flex-col gap-5"
        style={{ maxWidth: `${MAX_LANDING_PAGE_WIDTH}px` }}
      >
        <p className="text-sm text-muted-foreground">Dashboard</p>

        <Tabs value="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-10">
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                <div className="flex flex-col items-center select-none cursor-pointer">
                  <EmptyPaperNotes />
                  <p className="text-sm">Create paper</p>
                </div>

                {[1, 2, 3].map((page) => (
                  <div key={page} className="flex flex-col relative justify-start gap-2">
                    <div className="overflow-hidden aspect-5/3">
                      <img
                        className="dark:hidden w-full object-cover border w-full h-full opacity-[0.7] rounded-[3px]"
                        src={abstractLightPic.src}
                        width={640}
                        height={360}
                        loading="lazy"
                        decoding="async"
                      />
                      <img
                        className="hidden dark:block w-full object-cover w-full h-full border opacity-[0.4] rounded-[3px]"
                        src={abstractDarkPic.src}
                        width={640}
                        height={360}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <Skeleton className="w-full h-[16px]" />
                    <Skeleton className="w-[90%] h-[16px]" />
                  </div>
                ))}
              </div>

              <div className="mt-20 space-y-4">
                <p className="text-sm text-muted-foreground">Projects</p>

                <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
                  {[1, 2, 3, 4].map((_, index) => (
                    <div className="flex flex-col items-center" key={index}>
                      <FolderNotes className="opacity-[0.5] hover:opacity-[1] transition-all duration-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
