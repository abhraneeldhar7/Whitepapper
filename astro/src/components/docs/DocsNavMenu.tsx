import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type NavPage = {
  title: string;
  route: string;
  children?: NavPage[];
};

type NavSection = {
  title: string;
  pages: NavPage[];
};

type DocsNavMenuProps = {
  navSections: NavSection[];
  currentPath: string;
  className?: string;
  navClassName?: string;
  onNavigate?: () => void;
};

export default function DocsNavMenu({
  navSections,
  currentPath,
  className,
  navClassName,
  onNavigate,
}: DocsNavMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;

      const viewport = root.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
      const active = viewport?.querySelector<HTMLElement>("[data-doc-nav-active='true']");
      if (!viewport || !active) return;

      const targetTop = active.offsetTop - viewport.clientHeight / 2 + active.clientHeight / 2;
      viewport.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [currentPath]);

  return (
    <div ref={rootRef} className={cn("h-full w-full", className)}>
      <ScrollArea className="h-full w-full pr-2">
        <nav className={cn("pr-2 pb-10", navClassName)} aria-label="Documentation navigation">
          {navSections.map((section) => (
            <div key={section.title} className="mt-5 first:mt-0">
              <Label>{section.title}</Label>
              <ul className="mt-2 space-y-1">
                {section.pages.map((page) => {
                  const isPageActive = currentPath === page.route;

                  return (
                    <li key={page.route}>
                      <a
                        href={page.route}
                        data-astro-prefetch="viewport"
                        onClick={onNavigate}
                        className="block"
                      >
                        <Button
                          variant={isPageActive ? "secondary" : "ghost"}
                          className="w-full justify-start font-[400]"
                          aria-current={isPageActive ? "page" : undefined}
                          data-doc-nav-active={isPageActive ? "true" : undefined}
                        >
                          {page.title}
                        </Button>
                      </a>

                      {page.children?.map((child) => {
                        const isChildActive = currentPath === child.route;

                        return (
                          <a
                            key={child.route}
                            href={child.route}
                            data-astro-prefetch="viewport"
                            onClick={onNavigate}
                            className="block"
                          >
                            <Button
                              variant={isChildActive ? "default" : "ghost"}
                              size="sm"
                              className={cn(
                                "ml-5 w-[calc(100%-1.25rem)] justify-start"
                              )}
                              aria-current={isChildActive ? "page" : undefined}
                              data-doc-nav-active={isChildActive ? "true" : undefined}
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
    </div>
  );
}