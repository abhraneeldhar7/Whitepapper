import { MenuIcon } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "../ui/button";
import UserPopover from "../pre_made_components/user_popover/userPopover";
import type { UserDoc } from "@/lib/types";

type NavButton = {
  title: string;
  href: string;
};

type LandingMobileMenuProps = {
  navButtons: NavButton[];
  clientUserData?: UserDoc | null;
};

export default function LandingMobileMenu({ navButtons, clientUserData }: LandingMobileMenuProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open navigation menu">
          <MenuIcon className="size-5" />
        </Button>

      </SheetTrigger>

      <SheetContent
        side="right"
        className="z-50 h-full data-[side=right]:w-full border-none bg-background sm:max-w-none p-5"
      >
        <SheetHeader className="items-start p-0 text-left">
          <div className="flex items-center gap-3 text-[18px] leading-[1em]">
            <img src="/appLogo.png" height="30" width="30" alt="Whitepapper" />
            <SheetTitle className="font-[400]">Whitepapper</SheetTitle>
          </div>
        </SheetHeader>

        {clientUserData ?
          <div className="flex gap-4 items-center my-3">
            <a href="/dashboard" className="w-full">
            <Button className="w-full" size="lg">Go to Dashboard</Button></a>
            <div className="shrink-0">
            <UserPopover user={clientUserData} />
            </div>
          </div>
          :
          <a href="/login" className="w-full my-3" >
            <Button className="w-full" size="lg">Login</Button>
          </a>
        }

        <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
          {navButtons.map((button) => (
            <a key={button.href} href={button.href} className="w-full text-[50px] font-[500]">
              {button.title}
            </a>
          ))}
        </nav>

        <p className="mt-auto text-center text-[14px]">Antkin Studios</p>
      </SheetContent>
    </Sheet>
  );
}
