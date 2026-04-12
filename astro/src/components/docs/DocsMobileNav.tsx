import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

type NavPage = {
  title: string;
  route: string;
  children?: NavPage[];
};

type NavSection = {
  title: string;
  pages: NavPage[];
};

type DocsMobileNavProps = {
  navSections: NavSection[];
  currentPath: string;
};

export default function DocsMobileNav({ navSections, currentPath }: DocsMobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="data-[side=left]:w-full p-1 bg-background/60 dark:bg-background/70">
        <SheetHeader>
          <SheetTitle className="flex gap-4 items-center">
            <img src="/appLogo.png" height="30" width="30" alt="Whitepapper" />
            <h1 className="text-[20px]">Documentation</h1>
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-full">
          <nav className="p-4 pb-10 space-y-4">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1 mb-5">
                <Label>{section.title}</Label>
                <ul className="space-y-1 mt-3">
                  {section.pages.map((item) => {
                    const isActive = item.route === currentPath;
                    return (
                      <li key={item.route}>
                        <a href={item.route}>
                          <Button
                            size="lg"
                            variant={isActive ? "default" : "ghost"}
                            className="w-full justify-start"
                          >
                            {item.title}
                          </Button>
                        </a>
                        {item.children?.map((child) => {
                          const isChildActive = child.route === currentPath;
                          return (
                            <a key={child.route} href={child.route} className="block">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                  "ml-5 w-[calc(100%-1.25rem)] justify-start",
                                  isChildActive ? "bg-muted text-foreground" : ""
                                )}
                              >
                                {child.title}
                              </Button>
                            </a>
                          );
                        })}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
