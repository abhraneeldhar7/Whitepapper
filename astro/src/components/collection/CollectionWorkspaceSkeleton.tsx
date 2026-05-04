import FolderNotes from "../folderComponent";
import { Label } from "../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from "../ui/skeleton";
import abstractLightPic from "@/assets/abstract_light.jpg";
import abstractDarkPic from "@/assets/abstract_dark.jpg";
import { MAX_LANDING_PAGE_WIDTH } from "@/lib/design";

export default function CollectionWorkspaceSkeleton() {
  return (
    <div className="min-h-screen bg-background px-5 md:px-15 pt-20">
      <div className="z-[10] flex justify-end fixed top-5 right-5 ">
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>

      <div className="mx-auto w-full" style={{ maxWidth: `${MAX_LANDING_PAGE_WIDTH}px` }}>

        <div className="mx-auto flex w-full flex-col gap-5">

          <div className="text-sm text-muted-foreground flex flex-row gap-2 items-center">
            <a href="/dashboard" className="transition-all duration-300 hover:text-foreground">Dashboard</a> 
            /
            <Skeleton className="w-[120px] h-[14px]" />
          </div>

          <Tabs value="overview">
            <TabsList className="sticky top-5 z-[10]">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-10">
              <div className="flex gap-15 md:flex-row flex-col">
                <div className="space-y-6 md:flex-1">
                  <div className="md:max-w-[400px] space-y-6">
                    <div className="flex md:flex-row flex-col md:gap-10 gap-6">
                      <div>
                        <Label>Project Logo</Label>
                        <div className="flex items-center gap-3 mt-3">
                          <div className="flex md:flex-col items-start gap-2">
                            <Skeleton className="h-[90px] w-[90px] rounded-[10px]" />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-5 w-full">
                        <div className="space-y-2">
                          <Label htmlFor="project-name">Project name</Label>
                          <Skeleton className="w-full h-[15px]" />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="project-slug">Project URL</Label>
                          <Skeleton className="w-full h-[15px]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 mt-15">
                    <Label>Project description</Label>
                    <div className="mt-6 space-y-1">
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                      <Skeleton className="w-full h-[15px]" />
                    </div>
                  </div>
                </div>

                <div className="md:flex-1 space-y-10">
                  <div className="space-y-5">
                    <Label>Pages</Label>

                    <div className="grid grid-cols-2 gap-5">
                      {[1, 2].map((page) => (
                        <div key={page} className="flex flex-col relative justify-start gap-2">
                          <div className="overflow-hidden aspect-5/3">
                            <img className="dark:hidden w-full object-cover border w-full h-full opacity-[0.7] rounded-[3px]" src={abstractLightPic.src} width={640} height={360} loading="lazy" decoding="async" />
                            <img className="hidden dark:block w-full object-cover w-full h-full border opacity-[0.4] rounded-[3px]" src={abstractDarkPic.src} width={640} height={360} loading="lazy" decoding="async" />
                          </div>
                          <Skeleton className="w-full h-[16px]" />
                          <Skeleton className="w-[90%] h-[16px]" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <Label>Collections</Label>
                    <div className="grid grid-cols-2 gap-5">
                      {[1, 2, 3, 4].map((_, i) => (
                        <div key={i} className="flex flex-col items-center">
                          <FolderNotes />
                          <Skeleton className="h-4 w-20 mt-2" />
                          <Skeleton className="h-3 w-12 mt-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
