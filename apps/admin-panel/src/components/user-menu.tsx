import { KeyRoundIcon, LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useMe } from "@trestle/api-client/react";
import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trestle/ui/components/ui/dropdown-menu";

import { api } from "@/lib/api";
import { markSignedOut } from "@/lib/session";

export function UserMenu() {
  const me = useMe();
  const navigate = useNavigate();

  async function signOut() {
    // Revoke the session on the server first, so a copied cookie stops working. If the API is unreachable the
    // person is still signed out here.
    try {
      await api.auth.logout();
    } catch {
      // Ignored on purpose: sign-out must work offline too.
    }
    // Nothing from this session should be shown to whoever signs in next on this browser.
    markSignedOut();
    navigate("/login", { replace: true });
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
        <DropdownMenuItem onSelect={() => navigate("/account")}>
          <KeyRoundIcon />
          Account and security
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
