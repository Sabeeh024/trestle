import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { getT } from "next-i18next/server";

import { isApiError } from "@trestle/api-client";
import { createQueries, getQueryClient } from "@trestle/api-client/query";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Button } from "@trestle/ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarGroup } from "@trestle/ui/components/ui/avatar";

import { ArchiveProjectButton } from "@/components/archive-project-button";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { api } from "@/lib/api";
import { ProjectViewClient } from "./project-view-client";

export default async function ProjectViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const { projectId } = await params;
  const { task: requestedTask } = await searchParams;

  const project = await api.projects.get(projectId).catch((error: unknown) => {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  });

  // Prefetch what the interactive board needs and hand it to the client through hydration, so the
  // first paint already has the tasks and the open task's details. The client then takes over with
  // live queries, which is what lets comments and later edits update without a page reload.
  const queries = createQueries(api);
  const queryClient = getQueryClient();
  const tasks = await queryClient.fetchQuery(queries.projects.tasks(projectId));
  // Open the task named in the URL (a search result links to one), otherwise the first.
  const openTask = tasks.data.find((task) => task.id === requestedTask) ?? tasks.data[0];
  if (openTask) await queryClient.prefetchQuery(queries.tasks.detail(openTask.id));

  const { t } = await getT(["app", "domain"]);
  const archived = project.status === "archived";

  return (
    <>
      <Sidebar active="projects" />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={[t("app:nav.projects"), project.name]} />

        <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-6 pt-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl leading-heading font-bold">{project.name}</h1>
              {archived ? <Badge variant="secondary">{t("domain:projectStatus.archived")}</Badge> : null}
            </div>
            <p className="mt-1 text-sm text-text-secondary">{project.description}</p>
          </div>
          <div className="flex items-center gap-4">
            <AvatarGroup>
              {project.members.map((member) => (
                <Avatar key={member.id}>
                  <AvatarFallback>{member.initials}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            <ArchiveProjectButton projectId={projectId} name={project.name} archived={archived} />
            <NewTaskDialog projectId={projectId}>
              <Button>{t("app:projectView.newTask")}</Button>
            </NewTaskDialog>
          </div>
        </div>

        <HydrationBoundary state={dehydrate(queryClient)}>
          {/* Keyed by the opened task so choosing another task from search in the same project re-selects it. */}
          <ProjectViewClient key={openTask?.id} projectId={projectId} initialTaskId={openTask?.id ?? null} />
        </HydrationBoundary>
      </div>
    </>
  );
}
