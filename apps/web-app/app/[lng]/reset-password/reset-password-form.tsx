"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useT } from "next-i18next/client";

import { ApiError } from "@trestle/api-client";
import { resetPasswordSchema } from "@trestle/api-client/schemas";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";

import { resetPasswordAction } from "@/lib/auth-actions";
import { useValidationTranslate } from "@/lib/use-validation-translate";

export function ResetPasswordForm({ token }: { token: string }) {
  const { t } = useT("app");
  const tv = useValidationTranslate();
  const { lng } = useParams<{ lng: string }>();

  const [done, setDone] = useState(false);
  const form = useZodForm(resetPasswordSchema, { defaultValues: { token, password: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      const result = await resetPasswordAction(values);
      if (!result.ok) {
        const message = result.code === "invalid_token" ? t("resetPassword.invalidLink") : result.message;
        throw new ApiError(message, result.code, result.status, result.fields);
      }
      setDone(true);
    },
    t("forms.genericError"),
  );

  const formError = rootError(form, tv);

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-center" role="status">
        <p className="font-semibold">{t("resetPassword.doneTitle")}</p>
        <p className="text-sm text-text-secondary">{t("resetPassword.doneBody")}</p>
        <Button asChild className="w-full">
          <Link href={`/${lng}/login`}>{t("forgotPassword.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {formError ? <FormError>{formError}</FormError> : null}

      <Field label={t("resetPassword.passwordLabel")} error={fieldError(form, "password", tv)} required>
        {(control) => <Input type="password" autoComplete="new-password" placeholder="••••••••" {...control} {...form.register("password")} />}
      </Field>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("resetPassword.submitting") : t("resetPassword.submit")}
      </Button>
    </form>
  );
}
