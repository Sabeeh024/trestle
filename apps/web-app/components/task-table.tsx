import { getT } from "next-i18next/server";

import type { Priority, Task, TaskStatus } from "@trestle/api-client/types";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@trestle/ui/components/ui/table";

import { TaskCheckbox } from "@/components/task-checkbox";
import { formatDate, todayIso } from "@/lib/format";

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

// The table of tasks shared by the dashboard and My Tasks.
export async function TaskTable({
  tasks,
  projectNames,
  locale,
  emptyLabel,
}: {
  tasks: Task[];
  projectNames: Map<string, string>;
  locale: string;
  emptyLabel: string;
}) {
  const { t } = await getT(["app", "domain"]);
  const today = todayIso();

  return (
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
          {tasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-text-secondary">
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : null}
          {tasks.map((task) => {
            const done = task.status === "done";
            const overdue = !done && task.dueDate !== null && task.dueDate < today;
            return (
              <TableRow key={task.id}>
                <TableCell>
                  <TaskCheckbox taskId={task.id} title={task.title} done={done} />
                </TableCell>
                <TableCell className={done ? "text-text-disabled line-through" : "text-text-primary"}>{task.title}</TableCell>
                <TableCell>
                  <Badge variant="secondary" shape="tag">
                    {projectNames.get(task.projectId)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={priorityVariant[task.priority]} dot>
                    {t(`domain:priority.${task.priority}`)}
                  </Badge>
                </TableCell>
                <TableCell className={overdue ? "font-semibold text-feedback-danger" : "text-text-secondary"}>
                  {formatDate(task.dueDate, locale)}
                  {overdue ? <span className="sr-only"> ({t("app:myTasks.overdue")})</span> : null}
                </TableCell>
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
  );
}
