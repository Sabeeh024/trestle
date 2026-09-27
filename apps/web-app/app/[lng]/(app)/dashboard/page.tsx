import { getT } from "next-i18next/server";

import { Button } from "@trestle/ui/components/ui/button";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Avatar, AvatarFallback, AvatarGroup } from "@trestle/ui/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trestle/ui/components/ui/table";
import { Checkbox } from "@trestle/ui/components/ui/checkbox";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { currentUser, dashboardTasks, projects, type Priority, type TaskStatus } from "@/lib/mock-data";

const priorityVariant: Record<Priority, "destructive" | "warning" | "secondary"> = {
  urgent: "destructive",
  high: "warning",
  medium: "secondary",
  low: "secondary",
};

const statusVariant: Record<TaskStatus, "secondary" | "accent" | "success"> = {
  todo: "secondary",
  inProgress: "accent",
  inReview: "accent",
  done: "success",
};

export default async function DashboardPage() {
  const { t } = await getT(["app", "domain"]);
  const recentProjects = projects.slice(0, 4);

  return (
    <>
      <Sidebar active="home" />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={[t("app:nav.workspace"), t("app:dashboard.title")]} />

        <div className="flex flex-1 flex-col gap-8 p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl leading-heading font-bold">
                {t("app:dashboard.greeting", { name: currentUser.name.split(" ")[0] })}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">{t("app:dashboard.subtitle")}</p>
            </div>
            <Button>{t("app:dashboard.newTask")}</Button>
          </div>

          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{t("app:dashboard.recentProjects")}</h2>
              <a href="#" className="text-sm text-text-secondary hover:text-text-primary">
                {t("app:dashboard.viewAll")}
              </a>
            </div>

            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background-subtle p-5"
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
                      {project.members.map((initials) => (
                        <Avatar key={initials} size="sm">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                      ))}
                    </AvatarGroup>
                    <p className="text-xs text-text-disabled">
                      {t("app:dashboard.updatedAgo", { time: project.updatedAgo })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("app:dashboard.myTasks")}</h2>
              <div className="flex gap-1 rounded-md bg-muted p-1">
                <span className="rounded-sm bg-background px-3 py-1.5 text-sm font-semibold shadow-sm">
                  {t("app:dashboard.tabs.all")}
                </span>
                <span className="px-3 py-1.5 text-sm text-text-secondary">{t("app:dashboard.tabs.today")}</span>
                <span className="px-3 py-1.5 text-sm text-text-secondary">{t("app:dashboard.tabs.upcoming")}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>{t("app:dashboard.table.task")}</TableHead>
                    <TableHead>{t("app:dashboard.table.project")}</TableHead>
                    <TableHead>{t("app:dashboard.table.priority")}</TableHead>
                    <TableHead>{t("app:dashboard.table.due")}</TableHead>
                    <TableHead>{t("app:dashboard.table.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardTasks.map((task) => {
                    const project = projects.find((p) => p.id === task.projectId);
                    const done = task.status === "done";
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <Checkbox checked={done} />
                        </TableCell>
                        <TableCell className={done ? "text-text-disabled line-through" : "text-text-primary"}>
                          {task.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" shape="tag">
                            {project?.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={priorityVariant[task.priority]} dot>
                            {t(`domain:priority.${task.priority}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-text-secondary">{task.due}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[task.status]} dot>
                            {t(`domain:taskStatus.${task.status}`)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
