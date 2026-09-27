import { getT } from "next-i18next/server";

import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";

import { currentUser } from "@/lib/mock-data";

export async function TopBar({ crumbs }: { crumbs: string[] }) {
  const { t } = await getT("app");

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
      <div className="flex shrink-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-text-disabled">/</span> : null}
            <span className={i === crumbs.length - 1 ? "font-semibold text-text-primary" : "text-text-disabled"}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      <div className="flex max-w-90 flex-1 items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-1.5">
        <span className="text-sm text-text-disabled">{t("topbar.searchPlaceholder")}</span>
        <span className="rounded-sm border border-border-strong px-1 text-xs font-semibold text-text-disabled">
          ⌘K
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <Avatar size="sm">
          <AvatarFallback>{currentUser.initials}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
