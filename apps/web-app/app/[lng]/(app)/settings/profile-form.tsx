"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { updateProfileSchema } from "@trestle/api-client/schemas";
import { useUpdateProfile } from "@trestle/api-client/react";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";

import { useValidationTranslate } from "@/lib/use-validation-translate";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const { t } = useT("app");
  const tv = useValidationTranslate();
  const router = useRouter();

  const [saved, setSaved] = useState(false);
  const updateProfile = useUpdateProfile();
  const form = useZodForm(updateProfileSchema, { defaultValues: { name, email } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      setSaved(false);
      await updateProfile.mutateAsync(values);
      // The sidebar and top bar are Server Components, so ask Next to re-render them with the new name.
      router.refresh();
      form.reset(values);
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
        <Field label={t("signup.nameLabel")} error={fieldError(form, "name", tv)} required>
          {(control) => (
            <Input autoComplete="name" {...control} {...form.register("name", { onChange: () => setSaved(false) })} />
          )}
        </Field>

        <Field label={t("login.emailLabel")} error={fieldError(form, "email", tv)} required>
          {(control) => (
            <Input
              type="email"
              autoComplete="email"
              {...control}
              {...form.register("email", { onChange: () => setSaved(false) })}
            />
          )}
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !form.formState.isDirty}>
          {submitting ? t("settings.profile.saving") : t("settings.profile.save")}
        </Button>
        {saved ? (
          <span role="status" className="text-sm text-feedback-success">
            {t("settings.profile.saved")}
          </span>
        ) : null}
      </div>
    </form>
  );
}
