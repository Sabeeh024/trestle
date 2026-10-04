import { LogOutIcon } from "lucide-react";

import { useMe } from "@trestle/api-client/react";
import { getQueryClient } from "@trestle/api-client/query";
import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trestle/ui/components/ui/dropdown-menu";

import { clearToken } from "@/lib/session";

export function UserMenu() {
  const me = useMe();

  function signOut() {
    clearToken();
    // Nothing from this session should be shown to whoever signs in next on this browser.
    getQueryClient().clear();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <Avatar size="sm">
          <AvatarFallback>{me.data?.initials ?? "…"}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {me.data ? (
          <>
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">{me.data.name}</span>
              <span className="text-xs font-normal text-muted-foreground">{me.data.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
