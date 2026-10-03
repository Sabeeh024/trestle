"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { createTaskSchema } from "@trestle/api-client/schemas";
import { useCreateTask } from "@trestle/api-client/react";
import { Controller, fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Textarea } from "@trestle/ui/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trestle/ui/components/ui/select";
import { Field, FormError } from "@trestle/ui/components/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@trestle/ui/components/ui/dialog";

import { useValidationTranslate } from "@/lib/use-validation-translate";

const priorities = ["urgent", "high", "medium", "low"] as const;

interface NewTaskDialogProps {
  children: React.ReactNode;
  /** Create the task in this project, and don't ask which one. */
  projectId?: string;
  /** Otherwise the person picks from these. */
  projects?: { id: string; name: string }[];
  /** Who the new task is assigned to; unassigned when omitted. */
  assigneeId?: string;
}

export function NewTaskDialog({ children, projectId, projects = [], assigneeId }: NewTaskDialogProps) {
  const { t } = useT("app");
  const { t: tDomain } = useT("domain");
  const { t: tCommon } = useT("common");
  const tv = useValidationTranslate();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const createTask = useCreateTask();
  const form = useZodForm(createTaskSchema, {
    defaultValues: { projectId: projectId ?? "", title: "", description: "", priority: "medium", dueDate: "" },
  });

  const onSubmit = submitForm(
    form,
    async (values) => {
      await createTask.mutateAsync({ ...values, ...(assigneeId ? { assigneeId } : {}) });
      setOpen(false);
      form.reset();
      // Server Components (the dashboard's task list) don't watch React Query, so ask Next to re-render.
      router.refresh();
    },
    t("forms.genericError"),
  );

  const formError = rootError(form, tv);
  const submitting = form.formState.isSubmitting;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) form.reset();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newTask.title")}</DialogTitle>
          <DialogDescription>{t("newTask.description")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          {projectId ? null : (
            <Field label={t("newTask.projectLabel")} error={fieldError(form, "projectId", tv)} required>
              {(control) => (
                <Controller
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" onBlur={field.onBlur} {...control}>
                        <SelectValue placeholder={t("newTask.projectPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>
          )}

          <Field label={t("newTask.titleLabel")} error={fieldError(form, "title", tv)} required>
            {(control) => (
              <Input placeholder={t("newTask.titlePlaceholder")} autoComplete="off" {...control} {...form.register("title")} />
            )}
          </Field>

          <Field label={t("newTask.descriptionLabel")} error={fieldError(form, "description", tv)}>
            {(control) => <Textarea {...control} {...form.register("description")} />}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label={t("newTask.priorityLabel")} error={fieldError(form, "priority", tv)}>
              {(control) => (
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full" onBlur={field.onBlur} {...control}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorities.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {tDomain(`priority.${priority}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>

            <Field label={t("newTask.dueDateLabel")} error={fieldError(form, "dueDate", tv)}>
              {(control) => <Input type="date" {...control} {...form.register("dueDate")} />}
            </Field>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("newTask.creating") : t("newTask.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
