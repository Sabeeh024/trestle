import { getT } from "next-i18next/server";

import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";

import { CommandMenu } from "@/components/command-menu";
import { api } from "@/lib/api";

export async function TopBar({ crumbs }: { crumbs: string[] }) {
  const { t } = await getT("app");
  const me = await api.auth.me();

  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-6">
      <div className="flex shrink-0 items-center gap-1.5 text-sm">
        {[me.orgName, ...crumbs].map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-text-disabled">/</span> : null}
            <span className={i === crumbs.length - 1 ? "font-semibold text-text-primary" : "text-text-disabled"}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      <CommandMenu placeholder={t("topbar.searchPlaceholder")} />

      <div className="flex shrink-0 items-center gap-4">
        <Avatar size="sm">
          <AvatarFallback>{me.initials}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
