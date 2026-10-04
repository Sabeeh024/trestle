import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";

import { Badge } from "@trestle/ui/components/ui/badge";
import { Button } from "@trestle/ui/components/ui/button";
import { UserMenu } from "@/components/user-menu";

export function AdminTopBar() {
  // The index.html script has already applied the saved theme, so start from what the page shows.
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("trestle-admin-theme", dark ? "dark" : "light");
    } catch {
      // Private browsing can refuse storage; the theme then just lasts for this visit.
    }
  }, [dark]);

  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-semibold">Admin Panel</span>
        <Badge variant="warning" shape="tag" className="uppercase tracking-wide">
          Staging
        </Badge>
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Toggle theme"
          onClick={() => setDark((v) => !v)}
        >
          {dark ? <MoonIcon /> : <SunIcon />}
        </Button>
        <UserMenu />
      </div>
    </div>
  );
}
