import { MenuIcon } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "../ui/button";

type NavButton = {
  title: string;
  href: string;
};

type LandingMobileMenuProps = {
  navButtons: NavButton[];
};

export default function LandingMobileMenu({ navButtons }: LandingMobileMenuProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <MenuIcon className="size-5" />
        </Button>

      </SheetTrigger>

      <SheetContent
        side="right"
        className="z-50 h-full data-[side=right]:w-full border-none bg-foreground/70 p-4 text-background backdrop-blur-[7px] sm:max-w-none"
      >
        <SheetHeader className="items-start p-0 text-left">
          <div className="flex items-center gap-2 text-[18px] leading-[1em]">
            <img src="/appLogo.png" height="30" width="30" alt="Whitepapper" />
            <SheetTitle className="text-background">Whitepapper</SheetTitle>
          </div>
        </SheetHeader>

        <a
          href="/sign-in"
          className="mt-7 inline-flex h-12 w-fit items-center justify-center rounded-sm bg-primary px-5 text-[17px] text-primary-foreground transition-all duration-300 hover:bg-primary/80 w-full"
        >
          Login
        </a>

        <div className="mt-10 flex flex-col gap-2">
          {navButtons.map((button) => (
            <a key={button.href} href={button.href} className="w-full text-[50px] font-[500]">
              {button.title}
            </a>
          ))}
        </div>

        <p className="mt-auto text-center text-[14px]">Antkin Studios</p>
      </SheetContent>
    </Sheet>
  );
}
