import { MenuIcon, XIcon } from "lucide-react";

import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import { AnimatedThemeToggler } from "../ui/animated-theme-toggler";

type NavButton = {
  title: string;
  href: string;
};

type LandingMobileMenuProps = {
  navButtons: NavButton[];
  isSignedIn?: boolean;
};

export default function LandingMobileMenu({ navButtons, isSignedIn = false }: LandingMobileMenuProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation menu">
          <MenuIcon className="size-5" />
        </Button>

      </SheetTrigger>

      <SheetContent
        showCloseButton={false}
        side="right"
        className="z-50 h-full data-[side=right]:w-full border-none bg-background sm:max-w-none p-5"
      >
        <SheetHeader className="items-start p-0 text-left">
          <div className="justify-between flex w-full">
            <div className="flex items-center gap-3 text-[18px] leading-[1em]">
              <img src="/appLogo.png" height="30" width="30" alt="Whitepapper" />
              <SheetTitle className="font-[400]">Whitepapper</SheetTitle>
            </div>
            <div className="flex gap-7">
              <AnimatedThemeToggler size={20} />
              <SheetClose><XIcon size={25} /></SheetClose>
            </div>
          </div>
        </SheetHeader>
        {isSignedIn ?
          <a href="/dashboard" className="w-full my-3" data-astro-prefetch="viewport">
            <Button className="w-full" size="lg">Go to Dashboard</Button>
          </a>
          :
          <a href="/login" className="w-full my-3" data-astro-prefetch="viewport">
            <Button className="w-full" size="lg">Login</Button>
          </a>
        }

        <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
          {navButtons.map((button) => (
            <a data-astro-prefetch="viewport" key={button.href} href={button.href} className="w-full text-[50px] font-[500]">
              {button.title}
            </a>
          ))}
        </nav>

        <p className="mt-auto text-center text-[14px]">Antkin Studios</p>
      </SheetContent>
    </Sheet>
  );
}
