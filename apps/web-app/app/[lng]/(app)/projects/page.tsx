import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import type { ProjectStatus } from "@trestle/api-client/types";

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

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { api } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";

const statusVariant: Record<ProjectStatus, "success" | "warning" | "secondary"> = {
  active: "success",
  planning: "warning",
  onHold: "secondary",
};

export default async function ProjectsPage() {
  const { t } = await getT(["app", "domain"]);
  const locale = await lng();
  const projects = await api.projects.list({ pageSize: 100 });

  return (
    <>
      <Sidebar active="projects" />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={[t("app:nav.workspace"), t("app:projects.title")]} />

        <div className="flex flex-1 flex-col gap-6 p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h1 className="text-2xl leading-heading font-bold">{t("app:projects.title")}</h1>
            <Button>{t("app:projects.newProject")}</Button>
          </div>

          <div className="flex gap-1 self-start rounded-md bg-muted p-1">
            <span className="rounded-sm bg-background px-3 py-1.5 text-sm font-semibold shadow-sm">
              {t("app:projects.tabs.all")}
            </span>
            <span className="px-3 py-1.5 text-sm text-text-secondary">{t("app:projects.tabs.active")}</span>
            <span className="px-3 py-1.5 text-sm text-text-secondary">{t("app:projects.tabs.archived")}</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("app:projects.table.project")}</TableHead>
                  <TableHead>{t("app:projects.table.status")}</TableHead>
                  <TableHead>{t("app:projects.table.progress")}</TableHead>
                  <TableHead>{t("app:projects.table.members")}</TableHead>
                  <TableHead>{t("app:projects.table.due")}</TableHead>
                  <TableHead>{t("app:projects.table.updated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.data.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <a href={`projects/${project.id}`} className="flex items-center gap-2.5 hover:underline">
                        <span
                          className={`size-7 shrink-0 rounded-md bg-categorical-${project.color}-light dark:bg-categorical-${project.color}-dark`}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text-primary">{project.name}</p>
                          <p className="truncate text-xs text-text-secondary">{project.description}</p>
                        </div>
                      </a>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[project.status]}>
                        {t(`domain:projectStatus.${project.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex w-35 items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-action-primary"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-secondary">{project.progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AvatarGroup>
                        {project.members.map((member) => (
                          <Avatar key={member.id} size="sm">
                            <AvatarFallback>{member.initials}</AvatarFallback>
                          </Avatar>
                        ))}
                      </AvatarGroup>
                    </TableCell>
                    <TableCell className="text-text-secondary">{formatDate(project.dueDate, locale)}</TableCell>
                    <TableCell className="text-text-disabled">
                      {formatRelative(project.updatedAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>
    </>
  );
}
