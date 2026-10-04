"use client";

import { useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { useUpdateTask } from "@trestle/api-client/react";
import { Checkbox } from "@trestle/ui/components/ui/checkbox";

// Ticks a task done or back to to-do. The task lists are Server Components, so after the update Next is
// asked to re-render them; the project board's own queries are refreshed by the mutation itself.
export function TaskCheckbox({ taskId, title, done }: { taskId: string; title: string; done: boolean }) {
  const { t } = useT("app");
  const router = useRouter();
  const updateTask = useUpdateTask();

  return (
    <Checkbox
      checked={done}
      disabled={updateTask.isPending}
      aria-label={t(done ? "tasks.markTodo" : "tasks.markDone", { title })}
      onCheckedChange={(checked) =>
        updateTask.mutate({ id: taskId, status: checked === true ? "done" : "todo" }, { onSuccess: () => router.refresh() })
      }
    />
  );
}
