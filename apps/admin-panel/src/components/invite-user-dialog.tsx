import { useState } from "react";

import { inviteUserSchema } from "@trestle/api-client/schemas";
import { useAdminOrganizations, useInviteUser } from "@trestle/api-client/react";
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

import { roleLabels, translate } from "@/lib/validation";

export function InviteUserDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const invite = useInviteUser();
  const organizations = useAdminOrganizations({ pageSize: 100 });
  const form = useZodForm(inviteUserSchema, { defaultValues: { email: "", name: "", orgId: "", role: "member" } });

  const onSubmit = submitForm(form, async (values) => {
    await invite.mutateAsync(values);
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
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>They will get an email to set up their account.</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label="Email" error={fieldError(form, "email", translate)} required>
            {(control) => (
              <Input type="email" placeholder="name@company.com" autoComplete="off" {...control} {...form.register("email")} />
            )}
          </Field>

          <Field label="Name" description="Optional. Defaults to the part of the email before the @." error={fieldError(form, "name", translate)}>
            {(control) => <Input autoComplete="off" {...control} {...form.register("name")} />}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Organization" error={fieldError(form, "orgId", translate)} required>
              {(control) => (
                <Controller
                  control={form.control}
                  name="orgId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange} disabled={organizations.isPending}>
                      <SelectTrigger className="w-full" onBlur={field.onBlur} {...control}>
                        <SelectValue placeholder={organizations.isPending ? "Loading…" : "Choose one"} />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.data?.data.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </Field>

            <Field label="Role" error={fieldError(form, "role", translate)}>
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
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
