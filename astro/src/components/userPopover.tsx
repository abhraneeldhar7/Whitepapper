"use client";

import { useState } from "react";
import { LaptopIcon, LogOutIcon, SettingsIcon, UserIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@clerk/astro/react";
import { useUser } from "@/components/providers/UserProvider";
import { Skeleton } from "@/components/ui/skeleton";
import type { UserDoc } from "@/lib/entities";

function getDisplayName(name: string | null | undefined, username: string | null | undefined): string {
  return name || username || "User";
}

function getAvatarFallback(displayName: string): string {
  return (displayName.trim().charAt(0) || "U").toUpperCase();
}

type UserPopoverProps = {
  user?: UserDoc | null;
};

export default function UserPopover({ user: propUser }: UserPopoverProps) {
  const { user: contextUser, isLoading } = useUser();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const user = propUser ?? contextUser;

  if (isLoading && !user) {
    return (
      <div className="h-9 w-9">
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <></>;
  }

  const displayName = getDisplayName(user?.displayName, user?.username);
  const avatarFallback = getAvatarFallback(displayName);

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
            <div className="relative w-full">
              <p className="text-[12px] absolute left-0 right-0 truncate font-[500] opacity-[0.8]">
                @{user.username}
              </p>
            </div>
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
          <a className="w-full" href="/dashboard">
            <Button variant="ghost" className="w-full justify-start">
              <div className="w-full justify-start flex items-center gap-[15px]">
                <LaptopIcon size={16} /> Dashboard
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

          <SignOutButton redirectUrl="/login">
            <Button variant="ghost" className="w-full justify-start">
              <div className="w-full justify-start flex items-center gap-[15px] text-destructive">
                <LogOutIcon size={16} /> Logout
              </div>
            </Button>
          </SignOutButton>
        </div>
      </PopoverContent>
    </Popover>
  );
}
