"use client";

import { useState } from "react";
import { LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@clerk/astro/react";
import type { UserDoc } from "@/lib/types";

function getDisplayName(name: string | null | undefined, username: string | null | undefined): string {
  return name || username || "User";
}

function getAvatarFallback(displayName: string): string {
  return (displayName.trim().charAt(0) || "U").toUpperCase();
}

type UserPopoverProps = {
  user: UserDoc
};

export default function UserPopover({ user }: UserPopoverProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const displayName = getDisplayName(user?.displayName, user?.username);
  const avatarFallback = getAvatarFallback(displayName);

  if (!user) return <></>

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button className="h-9 w-9 rounded-full overflow-hidden border cursor-pointer">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={displayName.slice(0, 1)} className="h-full w-full object-cover" />
          ) : (
            avatarFallback
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[220px] p-[6px] flex flex-col gap-[10px] mx-[10px]">
        <div className="flex gap-[8px]">
          <div className="h-[40px] min-w-[40px] rounded-[6px] overflow-hidden border bg-primary/10 flex items-center justify-center">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              avatarFallback
            )}
          </div>
          <div className="w-full">
            <p className="text-[15px] font-[500] truncate">{displayName}</p>
            <p className="text-[12px] truncate font-[500] opacity-[0.8]">
              {user ? `@${user.username}` : "Loading user..."}
            </p>
          </div>
        </div>
        <div className="flex flex-col w-full gap-1">
          <a className="w-full" href={`/${user.username}`}>
            <Button variant="ghost" className="w-full justify-start">
              <div className="w-full justify-start flex items-center gap-[15px]">
                <UserIcon size={16} /> Profile
              </div>
            </Button>
          </a>
          <a className="w-full" href="/settings">
            <Button variant="ghost" className="w-full justify-start">
              <div className="w-full justify-start flex items-center gap-[15px]">
                <SettingsIcon size={16} /> Settings
              </div>
            </Button>
          </a>

          <SignOutButton>
            <Button variant="ghost" className="w-full justify-start">
              <div className="w-full justify-start flex items-center gap-[15px] text-destructive">
                <LogOutIcon size={16} /> Logout
              </div>
            </Button>
          </SignOutButton>
        </div>
      </PopoverContent>
    </Popover >
  );
}
