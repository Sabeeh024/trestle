"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useT } from "next-i18next/client";

import { ApiError } from "@trestle/api-client";
import { forgotPasswordSchema } from "@trestle/api-client/schemas";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";

import { forgotPasswordAction } from "@/lib/auth-actions";
import { useValidationTranslate } from "@/lib/use-validation-translate";

export function ForgotPasswordForm() {
  const { t } = useT("app");
  const tv = useValidationTranslate();
  const { lng } = useParams<{ lng: string }>();

  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useZodForm(forgotPasswordSchema, { defaultValues: { email: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      const result = await forgotPasswordAction(values);
      if (!result.ok) throw new ApiError(result.message, result.code, result.status, result.fields);
      setSentTo(values.email);
    },
    t("forms.genericError"),
  );

  const formError = rootError(form, tv);

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4 text-center" role="status">
        <p className="font-semibold">{t("forgotPassword.sentTitle")}</p>
        <p className="text-sm text-text-secondary">{t("forgotPassword.sentBody", { email: sentTo })}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href={`/${lng}/login`}>{t("forgotPassword.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {formError ? <FormError>{formError}</FormError> : null}

      <Field label={t("login.emailLabel")} error={fieldError(form, "email", tv)} required>
        {(control) => (
          <Input
            type="email"
            autoComplete="email"
            placeholder={t("login.emailPlaceholder")}
            {...control}
            {...form.register("email")}
          />
        )}
      </Field>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
      </Button>

      <Button asChild variant="ghost" className="w-full">
        <Link href={`/${lng}/login`}>{t("forgotPassword.back")}</Link>
      </Button>
    </form>
  );
}
