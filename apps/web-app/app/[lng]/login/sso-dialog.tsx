"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { ApiError } from "@trestle/api-client";
import { ssoSchema } from "@trestle/api-client/schemas";
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

import { ssoAction } from "@/lib/auth-actions";
import { useValidationTranslate } from "@/lib/use-validation-translate";

export function SsoDialog({ children }: { children: React.ReactNode }) {
  const { t } = useT("app");
  const { t: tCommon } = useT("common");
  const tv = useValidationTranslate();
  const router = useRouter();
  const { lng } = useParams<{ lng: string }>();

  const [open, setOpen] = useState(false);
  const form = useZodForm(ssoSchema, { defaultValues: { email: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      const result = await ssoAction(values);
      if (!result.ok) {
        const message =
          result.code === "sso_not_enabled"
            ? t("sso.notEnabled")
            : result.code === "sso_not_configured"
              ? t("sso.notConfigured")
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
          <DialogTitle>{t("sso.title")}</DialogTitle>
          <DialogDescription>{t("sso.description")}</DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          {formError ? <FormError>{formError}</FormError> : null}

          <Field label={t("login.emailLabel")} error={fieldError(form, "email", tv)} required>
            {(control) => (
              <Input type="email" autoComplete="email" placeholder={t("login.emailPlaceholder")} {...control} {...form.register("email")} />
            )}
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {tCommon("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("sso.submitting") : t("sso.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
