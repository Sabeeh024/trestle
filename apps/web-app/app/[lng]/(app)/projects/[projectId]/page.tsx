import { notFound } from "next/navigation";
import { getT } from "next-i18next/server";

import { Button } from "@trestle/ui/components/ui/button";
import { Avatar, AvatarFallback, AvatarGroup } from "@trestle/ui/components/ui/avatar";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { projects } from "@/lib/mock-data";
import { ProjectViewClient } from "./project-view-client";

export default async function ProjectViewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = projects.find((p) => p.id === projectId);
  if (!project) notFound();

  const { t } = await getT("app");

  return (
    <>
      <Sidebar active="projects" />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={[t("nav.workspace"), t("nav.projects"), project.name]} />

        <div className="flex shrink-0 flex-wrap items-end justify-between gap-4 px-6 pt-6">
          <div>
            <h1 className="text-2xl leading-heading font-bold">{project.name}</h1>
            <p className="mt-1 text-sm text-text-secondary">{project.description}</p>
          </div>
          <div className="flex items-center gap-4">
            <AvatarGroup>
              {project.members.map((initials) => (
                <Avatar key={initials}>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            <Button>{t("projectView.newTask")}</Button>
          </div>
        </div>

        <ProjectViewClient />
      </div>
    </>
  );
}
