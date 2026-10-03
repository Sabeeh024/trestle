"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useT } from "next-i18next/client";

import { commentSchema } from "@trestle/api-client/schemas";
import type { Priority, Task, TaskStatus } from "@trestle/api-client/types";
import { useAddComment, useProjectTasks, useTask } from "@trestle/api-client/react";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Input } from "@trestle/ui/components/ui/input";
import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trestle/ui/components/ui/table";
import { Checkbox } from "@trestle/ui/components/ui/checkbox";
import { SidePanel, SidePanelBody, SidePanelFooter, SidePanelHeader } from "@trestle/ui/components/side-panel";
import { PropertyList, PropertyItem } from "@trestle/ui/components/property-list";

import { formatDate, formatRelative } from "@/lib/format";
import { useValidationTranslate } from "@/lib/use-validation-translate";

const priorityVariant: Record<Priority, "destructive" | "warning" | "secondary"> = {
  urgent: "destructive",
  high: "warning",
  medium: "secondary",
  low: "secondary",
};

const statusVariant: Record<TaskStatus, "secondary" | "accent" | "warning" | "success"> = {
  todo: "secondary",
  inProgress: "accent",
  inReview: "warning",
  done: "success",
};

const columns: TaskStatus[] = ["todo", "inProgress", "inReview", "done"];

function TaskCard({ task, active, onOpen }: { task: Task; active: boolean; onOpen: () => void }) {
  const { t } = useT("domain");
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex flex-col gap-2 rounded-lg border bg-background-subtle p-3 text-start ${
        active ? "border-action-primary" : "border-border"
      } ${task.status === "done" ? "opacity-70" : ""}`}
    >
      <p className={`text-sm font-medium ${task.status === "done" ? "text-text-primary line-through" : "text-text-primary"}`}>
        {task.title}
      </p>
      <div className="flex items-center justify-between">
        <Badge variant={priorityVariant[task.priority]} dot>
          {t(`priority.${task.priority}`)}
        </Badge>
        <Avatar size="sm">
          <AvatarFallback className="text-[9px]">{task.assignee?.initials ?? "—"}</AvatarFallback>
        </Avatar>
      </div>
    </button>
  );
}

export function ProjectViewClient({ projectId }: { projectId: string }) {
  const { t } = useT("app");
  const { t: tDomain } = useT("domain");
  const { t: tCommon } = useT("common");
  const { lng } = useParams<{ lng: string }>();
  const tv = useValidationTranslate();

  const [view, setView] = useState<"board" | "list">("board");
  // undefined means "not chosen yet", which opens the first task; null means the panel was closed.
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);

  const tasksQuery = useProjectTasks(projectId);
  const tasks = tasksQuery.data?.data ?? [];
  const activeId = selectedId === undefined ? (tasks[0]?.id ?? null) : selectedId;
  const task = useTask(activeId);
  const addComment = useAddComment();

  const commentForm = useZodForm(commentSchema, { defaultValues: { body: "" } });
  const submitComment = submitForm(
    commentForm,
    async ({ body }) => {
      if (!activeId) return;
      await addComment.mutateAsync({ taskId: activeId, body });
      commentForm.reset();
    },
    t("forms.genericError"),
  );
  const commentError = fieldError(commentForm, "body", tv) ?? rootError(commentForm, tv);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 gap-1 px-6 pt-4">
        <button
          type="button"
          onClick={() => setView("board")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-semibold ${
            view === "board" ? "bg-background shadow-sm" : "text-text-secondary"
          }`}
        >
          {t("projectView.board")}
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={`rounded-md px-3.5 py-1.5 text-sm font-semibold ${
            view === "list" ? "bg-background shadow-sm" : "text-text-secondary"
          }`}
        >
          {t("projectView.list")}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {tasksQuery.isPending ? (
          <p className="flex-1 p-6 text-sm text-text-secondary">{tCommon("loading")}</p>
        ) : tasksQuery.error ? (
          <p role="alert" className="flex-1 p-6 text-sm text-feedback-danger">
            {tasksQuery.error.message}
          </p>
        ) : view === "board" ? (
          <div className="flex flex-1 items-start gap-4 overflow-x-auto p-5">
            {columns.map((status) => {
              const columnTasks = tasks.filter((item) => item.status === status);
              return (
                <div key={status} className="flex w-65 shrink-0 flex-col gap-2.5">
                  <div className="flex items-center gap-2 px-1 text-sm font-semibold text-text-secondary">
                    <Badge variant={statusVariant[status]} dot shape="pill" className="border-none bg-transparent px-0" />
                    {tDomain(`taskStatus.${status}`)}
                    <span className="font-normal text-text-disabled">{columnTasks.length}</span>
                  </div>
                  {columnTasks.map((item) => (
                    <TaskCard key={item.id} task={item} active={item.id === activeId} onOpen={() => setSelectedId(item.id)} />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto p-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>{t("projectView.table.task")}</TableHead>
                  <TableHead>{t("projectView.table.priority")}</TableHead>
                  <TableHead>{t("projectView.table.assignee")}</TableHead>
                  <TableHead>{t("projectView.table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => setSelectedId(item.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={item.status === "done"} />
                    </TableCell>
                    <TableCell className={item.status === "done" ? "text-text-disabled line-through" : "text-text-primary"}>
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[item.priority]} dot>
                        {tDomain(`priority.${item.priority}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-secondary">{item.assignee?.initials ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[item.status]} dot>
                        {tDomain(`taskStatus.${item.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {activeId ? (
          <SidePanel>
            <SidePanelHeader onClose={() => setSelectedId(null)}>{activeId}</SidePanelHeader>
            <SidePanelBody className="overflow-y-auto">
              {task.isPending ? <p className="text-sm text-text-secondary">{tCommon("loading")}</p> : null}
              {task.error ? (
                <p role="alert" className="text-sm text-feedback-danger">
                  {task.error.message}
                </p>
              ) : null}
              {task.data ? (
                <>
                  <p className="text-lg leading-title font-semibold">{task.data.title}</p>

                  <PropertyList>
                    <PropertyItem label={t("projectView.panel.status")}>
                      <Badge variant={statusVariant[task.data.status]} dot>
                        {tDomain(`taskStatus.${task.data.status}`)}
                      </Badge>
                    </PropertyItem>
                    <PropertyItem label={t("projectView.panel.assignee")}>
                      {task.data.assignee ? (
                        <span className="flex items-center gap-2">
                          <Avatar size="sm">
                            <AvatarFallback>{task.data.assignee.initials}</AvatarFallback>
                          </Avatar>
                          {task.data.assignee.name}
                        </span>
                      ) : (
                        "—"
                      )}
                    </PropertyItem>
                    <PropertyItem label={t("projectView.panel.priority")}>
                      <Badge variant={priorityVariant[task.data.priority]} dot>
                        {tDomain(`priority.${task.data.priority}`)}
                      </Badge>
                    </PropertyItem>
                    <PropertyItem label={t("projectView.panel.dueDate")}>{formatDate(task.data.dueDate, lng)}</PropertyItem>
                  </PropertyList>

                  <div className="flex flex-col gap-2 border-t border-border pt-4">
                    <span className="text-sm font-semibold text-text-secondary">{t("projectView.panel.description")}</span>
                    <p className="text-sm text-text-primary">{task.data.description || "—"}</p>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border pt-4">
                    <span className="text-sm font-semibold text-text-secondary">{t("projectView.panel.comments")}</span>
                    {task.data.comments.map((item) => (
                      <div key={item.id} className="flex gap-2.5">
                        <Avatar size="sm" className="shrink-0">
                          <AvatarFallback>{item.author.initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold">{item.author.name}</span>
                            <span className="text-xs text-text-disabled">{formatRelative(item.createdAt, lng)}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{item.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </SidePanelBody>
            <SidePanelFooter className="flex-col">
              <form className="flex gap-2" onSubmit={submitComment} noValidate>
                <Input
                  aria-label={t("projectView.panel.addComment")}
                  aria-invalid={commentError ? true : undefined}
                  placeholder={t("projectView.panel.addComment")}
                  {...commentForm.register("body")}
                />
                <Button size="sm" type="submit" disabled={commentForm.formState.isSubmitting}>
                  {t("projectView.panel.send")}
                </Button>
              </form>
              {commentError ? (
                <p role="alert" className="text-xs text-feedback-danger">
                  {commentError}
                </p>
              ) : null}
            </SidePanelFooter>
          </SidePanel>
        ) : null}
      </div>
    </div>
  );
}
