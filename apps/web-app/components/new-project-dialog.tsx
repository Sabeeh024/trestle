"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { createProjectSchema } from "@trestle/api-client/schemas";
import { useCreateProject } from "@trestle/api-client/react";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Textarea } from "@trestle/ui/components/ui/textarea";
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

export function NewProjectDialog({ children }: { children: React.ReactNode }) {
  const { t } = useT("app");
  const { t: tCommon } = useT("common");
  const tv = useValidationTranslate();
  const router = useRouter();
  const { lng } = useParams<{ lng: string }>();

  const [open, setOpen] = useState(false);
  const createProject = useCreateProject();
  const form = useZodForm(createProjectSchema, { defaultValues: { name: "", description: "", dueDate: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      const project = await createProject.mutateAsync(values);
      setOpen(false);
      form.reset();
      router.push(`/${lng}/projects/${project.id}`);
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
          <DialogTitle>{t("newProject.title")}</DialogTitle>
          <DialogDescription>{t("newProject.description")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label={t("newProject.nameLabel")} error={fieldError(form, "name", tv)} required>
            {(control) => (
              <Input placeholder={t("newProject.namePlaceholder")} autoComplete="off" {...control} {...form.register("name")} />
            )}
          </Field>

          <Field label={t("newProject.descriptionLabel")} error={fieldError(form, "description", tv)}>
            {(control) => <Textarea {...control} {...form.register("description")} />}
          </Field>

          <Field label={t("newProject.dueDateLabel")} error={fieldError(form, "dueDate", tv)}>
            {(control) => <Input type="date" {...control} {...form.register("dueDate")} />}
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("newProject.creating") : t("newProject.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
