import { LogOutIcon } from "lucide-react";
import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Logo } from "@trestle/ui/components/logo";
import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";
import { Button } from "@trestle/ui/components/ui/button";
import { NavItem } from "@trestle/ui/components/nav-item";

import { api } from "@/lib/api";
import { signOutAction } from "@/lib/auth-actions";

const colorDot: Record<string, string> = {
  purple: "bg-categorical-purple-light dark:bg-categorical-purple-dark",
  cyan: "bg-categorical-cyan-light dark:bg-categorical-cyan-dark",
  green: "bg-categorical-green-light dark:bg-categorical-green-dark",
  orange: "bg-categorical-orange-light dark:bg-categorical-orange-dark",
  blue: "bg-categorical-blue-light dark:bg-categorical-blue-dark",
  pink: "bg-categorical-pink-light dark:bg-categorical-pink-dark",
};

export async function Sidebar({ active }: { active: "home" | "myTasks" | "projects" | "settings" }) {
  const { t } = await getT(["app", "domain"]);
  const locale = await lng();
  const [me, projects] = await Promise.all([api.auth.me(), api.projects.list({ pageSize: 3 })]);

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-1 border-e border-border bg-background-subtle p-3">
      <div className="mb-2 flex items-center gap-2 p-2">
        <Logo wordmark={false} size="sm" />
        <span className="truncate text-sm font-semibold">{t("app:nav.workspace")}</span>
      </div>

      <NavItem href={`/${locale}/dashboard`} active={active === "home"}>
        {t("app:nav.home")}
      </NavItem>
      <NavItem href={`/${locale}/my-tasks`} active={active === "myTasks"}>
        {t("app:nav.myTasks")}
      </NavItem>
      <NavItem href={`/${locale}/projects`} active={active === "projects"}>
        {t("app:nav.projects")}
      </NavItem>

      {active === "projects" || active === "home" ? (
        <div className="my-0.5 ms-6.5 flex flex-col gap-0.5">
          {projects.data.map((project) => (
            <a
              key={project.id}
              href={`/${locale}/projects/${project.id}`}
              className="flex items-center gap-2 truncate rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-muted/50 hover:text-text-primary"
            >
              <span className={`size-1.5 shrink-0 rounded-full ${colorDot[project.color]}`} />
              <span className="truncate">{project.name}</span>
            </a>
          ))}
        </div>
      ) : null}

      <NavItem href={`/${locale}/settings`} active={active === "settings"}>
        {t("app:nav.settings")}
      </NavItem>

      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        <Avatar size="sm">
          <AvatarFallback>{me.initials}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">{me.name}</span>
          <span className="truncate text-xs text-text-disabled">{t(`domain:role.${me.role}`)}</span>
        </div>
        <form action={signOutAction.bind(null, locale)}>
          <Button type="submit" variant="ghost" size="icon-sm" aria-label={t("app:account.signOut")} title={t("app:account.signOut")}>
            <LogOutIcon className="rtl:-scale-x-100" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
