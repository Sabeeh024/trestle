import { updateOrganizationSchema } from "@trestle/api-client/schemas";
import type { Organization } from "@trestle/api-client/types";
import { useUpdateOrganization } from "@trestle/api-client/react";
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
} from "@trestle/ui/components/ui/dialog";

import { planLabels, translate } from "@/lib/validation";

// Controlled, because it is opened from a row's menu rather than from a button of its own.
export function EditOrganizationDialog({
  organization,
  onClose,
}: {
  organization: Organization | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={organization !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {/* Keyed by organization so the form always starts from the one being edited. */}
        {organization ? <EditOrganizationForm key={organization.id} organization={organization} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditOrganizationForm({ organization, onClose }: { organization: Organization; onClose: () => void }) {
  const update = useUpdateOrganization();
  const form = useZodForm(updateOrganizationSchema, { defaultValues: { name: organization.name, plan: organization.plan } });

  const onSubmit = submitForm(form, async (values) => {
    await update.mutateAsync({ id: organization.id, ...values });
    onClose();
  });

  const formError = rootError(form, translate);
  const submitting = form.formState.isSubmitting;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit organization</DialogTitle>
        <DialogDescription>Changes are recorded in the audit log.</DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
        {formError ? <FormError>{formError}</FormError> : null}

        <Field label="Name" error={fieldError(form, "name", translate)} required>
          {(control) => <Input autoComplete="off" {...control} {...form.register("name")} />}
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
          <Button type="submit" disabled={submitting || !form.formState.isDirty}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
