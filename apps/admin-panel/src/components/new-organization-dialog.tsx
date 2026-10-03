import { useState } from "react";

import { createOrganizationSchema } from "@trestle/api-client/schemas";
import { useCreateOrganization } from "@trestle/api-client/react";
import { Controller, fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
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

import { planLabels, translate } from "@/lib/validation";

export function NewOrganizationDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const create = useCreateOrganization();
  const form = useZodForm(createOrganizationSchema, { defaultValues: { name: "", plan: "free" } });

  const onSubmit = submitForm(form, async (values) => {
    await create.mutateAsync(values);
    setOpen(false);
    form.reset();
  });

  const formError = rootError(form, translate);
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
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>New organizations start on a trial.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label="Name" error={fieldError(form, "name", translate)} required>
            {(control) => <Input placeholder="Acme Inc." autoComplete="off" {...control} {...form.register("name")} />}
          </Field>

          <Field label="Plan" error={fieldError(form, "plan", translate)}>
            {(control) => (
              <Controller
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" onBlur={field.onBlur} {...control}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(planLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create organization"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
