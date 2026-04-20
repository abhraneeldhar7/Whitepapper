import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import DocsNavMenu from "@/components/docs/DocsNavMenu";

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
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="data-[side=left]:w-full p-1 bg-background/60 dark:bg-background/70">
        <SheetHeader>
          <SheetTitle className="flex gap-4 items-center">
            <img src="/appLogo.png" height="30" width="30" alt="Whitepapper" />
            <p className="text-[20px]">Documentation</p>
          </SheetTitle>
        </SheetHeader>
        <DocsNavMenu
          navSections={navSections}
          currentPath={currentPath}
          className="h-[calc(100vh-92px)]"
          navClassName="p-4 pb-10"
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
