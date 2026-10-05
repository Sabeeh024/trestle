import Link from "next/link";
import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Button } from "@trestle/ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarGroup } from "@trestle/ui/components/ui/avatar";

import { NewTaskDialog } from "@/components/new-task-dialog";
import { Sidebar } from "@/components/sidebar";
import { TabLinks } from "@/components/tab-links";
import { TaskTable } from "@/components/task-table";
import { TopBar } from "@/components/topbar";
import { api } from "@/lib/api";
import { formatRelative, todayIso } from "@/lib/format";

type Tab = "all" | "today" | "upcoming";
const tabs: Tab[] = ["all", "today", "upcoming"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { t } = await getT(["app", "domain"]);
  const locale = await lng();
  const { tab: requested } = await searchParams;
  const tab: Tab = tabs.find((candidate) => candidate === requested) ?? "all";

  const [{ me, recentProjects, myTasks }, projects] = await Promise.all([
    api.dashboard.get(),
    api.projects.list({ pageSize: 100 }),
  ]);
  const projectNames = new Map(projects.data.map((project) => [project.id, project.name]));
  const openProjects = projects.data.filter((project) => project.status !== "archived");

  // "Today" is what is due today or already overdue and still open, since that is what needs attention
  // now; "Upcoming" is anything due after today.
  const today = todayIso();
  const visibleTasks = myTasks.filter((task) => {
    if (tab === "today") return task.status !== "done" && task.dueDate !== null && task.dueDate <= today;
    if (tab === "upcoming") return task.dueDate !== null && task.dueDate > today;
    return true;
  });

  return (
    <>
      <Sidebar active="home" />

      <main id="main-content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
        <TopBar crumbs={[t("app:dashboard.title")]} />

        <div className="flex flex-1 flex-col gap-8 p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl leading-heading font-bold">
                {t("app:dashboard.greeting", { name: me.name.split(" ")[0] })}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">{t("app:dashboard.subtitle")}</p>
            </div>
            <NewTaskDialog projects={openProjects.map(({ id, name }) => ({ id, name }))} assigneeId={me.id}>
              <Button>{t("app:dashboard.newTask")}</Button>
            </NewTaskDialog>
          </div>

          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{t("app:dashboard.recentProjects")}</h2>
              <Link href={`/${locale}/projects`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("app:dashboard.viewAll")}
              </Link>
            </div>

            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/${locale}/projects/${project.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background-subtle p-5 hover:border-border-strong"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-8 shrink-0 rounded-lg bg-categorical-${project.color}-light dark:bg-categorical-${project.color}-dark`}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{project.name}</p>
                      <p className="truncate text-sm text-text-secondary">{project.description}</p>
                    </div>
                  </div>

                  <div>
                    <div className="h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-action-primary"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-text-secondary">
                      {t("app:dashboard.percentComplete", { percent: project.progress })}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between">
                    <AvatarGroup>
                      {project.members.map((member) => (
                        <Avatar key={member.id} size="sm">
                          <AvatarFallback>{member.initials}</AvatarFallback>
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    <p className="text-xs text-text-tertiary">
                      {t("app:dashboard.updated", { time: formatRelative(project.updatedAt, locale) })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("app:dashboard.myTasks")}</h2>
              <TabLinks
                items={tabs.map((candidate) => ({
                  label: t(`app:dashboard.tabs.${candidate}`),
                  href: candidate === "all" ? `/${locale}/dashboard` : `/${locale}/dashboard?tab=${candidate}`,
                  active: candidate === tab,
                }))}
              />
            </div>

            <TaskTable
              tasks={visibleTasks}
              projectNames={projectNames}
              locale={locale}
              emptyLabel={t("app:dashboard.empty")}
            />
          </section>
        </div>
      </main>
    </>
  );
}
