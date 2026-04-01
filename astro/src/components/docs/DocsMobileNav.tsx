import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
};

type DocsMobileNavProps = {
  navItems: NavItem[];
  currentPath: string;
};

export default function DocsMobileNav({ navItems, currentPath }: DocsMobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <MenuIcon className="size-4" />
          Docs Menu
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[300px] p-0">
        <SheetHeader className="border-b p-4 text-left">
          <SheetTitle>Docs</SheetTitle>
        </SheetHeader>

        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = item.href === currentPath;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {item.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
