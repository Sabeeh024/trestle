"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { changePasswordSchema } from "@trestle/api-client/schemas";
import { useChangePassword } from "@trestle/api-client/react";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";

import { useValidationTranslate } from "@/lib/use-validation-translate";

export function PasswordForm() {
  const { t } = useT("app");
  const tv = useValidationTranslate();
  const router = useRouter();

  const [saved, setSaved] = useState(false);
  const changePassword = useChangePassword();
  const form = useZodForm(changePasswordSchema, { defaultValues: { currentPassword: "", newPassword: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      setSaved(false);
      await changePassword.mutateAsync(values);
      // Other devices were just signed out, so the list of sessions beside this form has changed.
      router.refresh();
      form.reset();
      setSaved(true);
    },
    t("forms.genericError"),
  );

  const formError = rootError(form, tv);
  const submitting = form.formState.isSubmitting;

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {formError ? <FormError>{formError}</FormError> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("settings.security.currentPassword")} error={fieldError(form, "currentPassword", tv)} required>
          {(control) => (
            <Input
              type="password"
              autoComplete="current-password"
              {...control}
              {...form.register("currentPassword", { onChange: () => setSaved(false) })}
            />
          )}
        </Field>

        <Field label={t("settings.security.newPassword")} error={fieldError(form, "newPassword", tv)} required>
          {(control) => (
            <Input
              type="password"
              autoComplete="new-password"
              {...control}
              {...form.register("newPassword", { onChange: () => setSaved(false) })}
            />
          )}
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? t("settings.security.saving") : t("settings.security.change")}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-feedback-success">
            {t("settings.security.changed")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
