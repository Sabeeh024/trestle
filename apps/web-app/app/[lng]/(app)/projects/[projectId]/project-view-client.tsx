"use client";

import { useState } from "react";
import { useT } from "next-i18next/client";

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

import { taskDetail, websiteRedesignTasks, type BoardTask, type Priority, type TaskStatus } from "@/lib/mock-data";

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

const columns: { status: TaskStatus; dotVariant: TaskStatus }[] = [
  { status: "todo", dotVariant: "todo" },
  { status: "inProgress", dotVariant: "inProgress" },
  { status: "inReview", dotVariant: "inReview" },
  { status: "done", dotVariant: "done" },
];

function TaskCard({ task, onOpen }: { task: BoardTask; onOpen: () => void }) {
  const { t } = useT("domain");
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex flex-col gap-2 rounded-lg border border-border bg-background-subtle p-3 text-start ${
        task.status === "done" ? "opacity-70" : ""
      }`}
    >
      <p className={`text-sm font-medium ${task.status === "done" ? "text-text-primary line-through" : "text-text-primary"}`}>
        {task.title}
      </p>
      <div className="flex items-center justify-between">
        <Badge variant={priorityVariant[task.priority]} dot>
          {t(`priority.${task.priority}`)}
        </Badge>
        <Avatar size="sm">
          <AvatarFallback className="text-[9px]">{task.assigneeInitials}</AvatarFallback>
        </Avatar>
      </div>
    </button>
  );
}

export function ProjectViewClient() {
  const { t } = useT("app");
  const { t: tDomain } = useT("domain");
  const [view, setView] = useState<"board" | "list">("board");
  const [panelOpen, setPanelOpen] = useState(true);

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
        {view === "board" ? (
          <div className="flex flex-1 items-start gap-4 overflow-x-auto p-5">
            {columns.map((col) => {
              const tasks = websiteRedesignTasks.filter((task) => task.status === col.status);
              return (
                <div key={col.status} className="flex w-65 shrink-0 flex-col gap-2.5">
                  <div className="flex items-center gap-2 px-1 text-sm font-semibold text-text-secondary">
                    <Badge variant={statusVariant[col.dotVariant]} dot shape="pill" className="border-none bg-transparent px-0" />
                    {tDomain(`taskStatus.${col.status}`)}
                    <span className="font-normal text-text-disabled">{tasks.length}</span>
                  </div>
                  {tasks.map((task) => (
                    <TaskCard key={task.id} task={task} onOpen={() => setPanelOpen(true)} />
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
                {websiteRedesignTasks.map((task) => (
                  <TableRow key={task.id} className="cursor-pointer" onClick={() => setPanelOpen(true)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={task.status === "done"} />
                    </TableCell>
                    <TableCell className={task.status === "done" ? "text-text-disabled line-through" : "text-text-primary"}>
                      {task.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant[task.priority]} dot>
                        {tDomain(`priority.${task.priority}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-secondary">{task.assigneeInitials}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[task.status]} dot>
                        {tDomain(`taskStatus.${task.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {panelOpen ? (
          <SidePanel>
            <SidePanelHeader onClose={() => setPanelOpen(false)}>{taskDetail.id}</SidePanelHeader>
            <SidePanelBody className="overflow-y-auto">
              <p className="text-lg leading-title font-semibold">{taskDetail.title}</p>

              <PropertyList>
                <PropertyItem label={t("projectView.panel.status")}>
                  <Badge variant={statusVariant[taskDetail.status]} dot>
                    {tDomain(`taskStatus.${taskDetail.status}`)}
                  </Badge>
                </PropertyItem>
                <PropertyItem label={t("projectView.panel.assignee")}>
                  <span className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback>{taskDetail.assigneeInitials}</AvatarFallback>
                    </Avatar>
                    {taskDetail.assignee}
                  </span>
                </PropertyItem>
                <PropertyItem label={t("projectView.panel.priority")}>
                  <Badge variant={priorityVariant[taskDetail.priority]} dot>
                    {tDomain(`priority.${taskDetail.priority}`)}
                  </Badge>
                </PropertyItem>
                <PropertyItem label={t("projectView.panel.dueDate")}>{taskDetail.dueDate}</PropertyItem>
              </PropertyList>

              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <span className="text-sm font-semibold text-text-secondary">{t("projectView.panel.description")}</span>
                <p className="text-sm text-text-primary">{taskDetail.description}</p>
              </div>

              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <span className="text-sm font-semibold text-text-secondary">{t("projectView.panel.comments")}</span>
                {taskDetail.comments.map((comment) => (
                  <div key={comment.time} className="flex gap-2.5">
                    <Avatar size="sm" className="shrink-0">
                      <AvatarFallback>{comment.initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold">{comment.author}</span>
                        <span className="text-xs text-text-disabled">{comment.time}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{comment.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SidePanelBody>
            <SidePanelFooter>
              <Input placeholder={t("projectView.panel.addComment")} />
              <Button size="sm">{t("projectView.panel.send")}</Button>
            </SidePanelFooter>
          </SidePanel>
        ) : null}
      </div>
    </div>
  );
}
