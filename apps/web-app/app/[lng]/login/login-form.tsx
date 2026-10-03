"use client";

import { useParams, useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { ApiError } from "@trestle/api-client";
import { loginSchema } from "@trestle/api-client/schemas";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Field, FormError } from "@trestle/ui/components/field";

import { useValidationTranslate } from "@/lib/use-validation-translate";
import { loginAction } from "./actions";

export function LoginForm() {
  const { t } = useT("app");
  const tv = useValidationTranslate();
  const router = useRouter();
  const { lng } = useParams<{ lng: string }>();

  const form = useZodForm(loginSchema, { defaultValues: { email: "", password: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      const result = await loginAction(values);
      if (!result.ok) {
        // The server's messages are English, so the two failures a person can cause get their own text.
        const message =
          result.code === "invalid_credentials"
            ? t("login.invalidCredentials")
            : result.code === "account_suspended"
              ? t("login.accountSuspended")
              : result.message;
        throw new ApiError(message, result.code, result.status, result.fields);
      }
      router.push(`/${lng}/dashboard`);
    },
    t("forms.genericError"),
  );

  const formError = rootError(form, tv);

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
      {formError ? <FormError>{formError}</FormError> : null}

      <Field label={t("login.emailLabel")} error={fieldError(form, "email", tv)}>
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
        error={fieldError(form, "password", tv)}
        labelAction={
          <a href="#" className="text-sm text-action-primary hover:text-action-primaryHover">
            {t("login.forgotPassword")}
          </a>
        }
      >
        {(control) => (
          <Input
            type="password"
            autoComplete="current-password"
            placeholder={t("login.passwordPlaceholder")}
            {...control}
            {...form.register("password")}
          />
        )}
      </Field>

      <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? t("login.signingIn") : t("login.signIn")}
      </Button>
    </form>
  );
}
