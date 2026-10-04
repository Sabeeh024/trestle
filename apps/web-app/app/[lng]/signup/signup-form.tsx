"use client";

import { useParams, useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { ApiError } from "@trestle/api-client";
import { signupSchema } from "@trestle/api-client/schemas";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";

import { signupAction } from "@/lib/auth-actions";
import { useValidationTranslate } from "@/lib/use-validation-translate";

export function SignupForm() {
  const { t } = useT("app");
  const tv = useValidationTranslate();
  const router = useRouter();
  const { lng } = useParams<{ lng: string }>();

  const form = useZodForm(signupSchema, { defaultValues: { name: "", email: "", password: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      const result = await signupAction(values);
      // An email that is already registered arrives as a field error and lands on the email field.
      if (!result.ok) throw new ApiError(result.message, result.code, result.status, result.fields);
      router.push(`/${lng}/dashboard`);
    },
    t("forms.genericError"),
  );

  const formError = rootError(form, tv);

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {formError ? <FormError>{formError}</FormError> : null}

      <Field label={t("signup.nameLabel")} error={fieldError(form, "name", tv)} required>
        {(control) => (
          <Input autoComplete="name" placeholder={t("signup.namePlaceholder")} {...control} {...form.register("name")} />
        )}
      </Field>

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

      <Field
        label={t("login.passwordLabel")}
        description={t("signup.passwordHint")}
        error={fieldError(form, "password", tv)}
        required
      >
        {(control) => (
          <Input
            type="password"
            autoComplete="new-password"
            placeholder={t("login.passwordPlaceholder")}
            {...control}
            {...form.register("password")}
          />
        )}
      </Field>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("signup.submitting") : t("signup.submit")}
      </Button>
    </form>
  );
}
