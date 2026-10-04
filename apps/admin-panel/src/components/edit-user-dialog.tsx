import { useState } from "react";

import { updateProfileSchema } from "@trestle/api-client/schemas";
import { useUpdateUser } from "@trestle/api-client/react";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
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

import { translate } from "@/lib/validation";

export function EditUserDialog({
  user,
  children,
}: {
  user: { id: string; name: string; email: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const updateUser = useUpdateUser();
  // `values` keeps the form in step with the user the panel is showing, and reset() returns to them.
  const form = useZodForm(updateProfileSchema, { values: { name: user.name, email: user.email } });

  const onSubmit = submitForm(form, async (values) => {
    await updateUser.mutateAsync({ id: user.id, ...values });
    setOpen(false);
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
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Changes are recorded in the audit log.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label="Name" error={fieldError(form, "name", translate)} required>
            {(control) => <Input autoComplete="off" {...control} {...form.register("name")} />}
          </Field>

          <Field label="Email" error={fieldError(form, "email", translate)} required>
            {(control) => <Input type="email" autoComplete="off" {...control} {...form.register("email")} />}
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting || !form.formState.isDirty}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
