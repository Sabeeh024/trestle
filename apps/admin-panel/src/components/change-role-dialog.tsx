import { useState } from "react";

import { changeRoleSchema } from "@trestle/api-client/schemas";
import type { UserRole } from "@trestle/api-client/types";
import { useChangeUserRole } from "@trestle/api-client/react";
import { Controller, fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
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

import { roleLabels, translate } from "@/lib/validation";

export function ChangeRoleDialog({
  user,
  children,
}: {
  user: { id: string; name: string; role: UserRole };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const changeRole = useChangeUserRole();
  const form = useZodForm(changeRoleSchema, { values: { role: user.role } });

  const onSubmit = submitForm(form, async ({ role }) => {
    await changeRole.mutateAsync({ id: user.id, role });
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
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>Choose what {user.name} can do in their organization.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label="Role" error={fieldError(form, "role", translate)} required>
            {(control) => (
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" onBlur={field.onBlur} {...control}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
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
            <Button type="submit" disabled={submitting || form.watch("role") === user.role}>
              {submitting ? "Saving…" : "Save role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
