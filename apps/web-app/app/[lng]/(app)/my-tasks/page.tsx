import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import type { TaskStatus } from "@trestle/api-client/types";

import { Sidebar } from "@/components/sidebar";
import { TabLinks } from "@/components/tab-links";
import { TaskTable } from "@/components/task-table";
import { TopBar } from "@/components/topbar";
import { api } from "@/lib/api";

const statuses: TaskStatus[] = ["todo", "inProgress", "inReview", "done"];

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { t } = await getT(["app", "domain"]);
  const locale = await lng();
  const { status: requested } = await searchParams;
  const status = statuses.find((candidate) => candidate === requested);

  const [tasks, projects] = await Promise.all([
    api.tasks.list({ assignee: "me", pageSize: 100, ...(status ? { status } : {}) }),
    api.projects.list({ pageSize: 100 }),
  ]);
  const projectNames = new Map(projects.data.map((project) => [project.id, project.name]));

  // Soonest due date first; tasks with no due date go last.
  const sorted = [...tasks.data].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  return (
    <>
      <Sidebar active="myTasks" />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={[t("app:nav.workspace"), t("app:myTasks.title")]} />

        <div className="flex flex-1 flex-col gap-6 p-8">
          <div>
            <h1 className="text-2xl leading-heading font-bold">{t("app:myTasks.title")}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t("app:myTasks.subtitle")}</p>
          </div>

          <TabLinks
            items={[
              { label: t("app:myTasks.tabs.all"), href: `/${locale}/my-tasks`, active: !status },
              ...statuses.map((candidate) => ({
                label: t(`domain:taskStatus.${candidate}`),
                href: `/${locale}/my-tasks?status=${candidate}`,
                active: candidate === status,
              })),
            ]}
          />

          <TaskTable tasks={sorted} projectNames={projectNames} locale={locale} emptyLabel={t("app:myTasks.empty")} />
        </div>
      </main>
    </>
  );
}
