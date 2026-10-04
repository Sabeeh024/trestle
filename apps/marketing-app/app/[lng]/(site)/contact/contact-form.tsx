"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useT } from "next-i18next/client";

import { ApiError } from "@trestle/api-client";
import { contactSchema } from "@trestle/api-client/schemas";
import { fieldError, rootError, submitForm, useZodForm } from "@trestle/forms";
import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Textarea } from "@trestle/ui/components/ui/textarea";
import { Field, FormError } from "@trestle/ui/components/field";

import { useValidationTranslate } from "@/lib/use-validation-translate";
import { sendContactAction } from "./actions";

export function ContactForm() {
  const { t } = useT("marketing");
  const tv = useValidationTranslate();
  const { lng } = useParams<{ lng: string }>();

  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useZodForm(contactSchema, { defaultValues: { name: "", email: "", company: "", message: "" } });

  const onSubmit = submitForm(
    form,
    async (values) => {
      const result = await sendContactAction(values);
      if (!result.ok) throw new ApiError(result.message, result.code, result.status, result.fields);
      setSentTo(values.email);
    },
    t("pages.contact.genericError"),
  );

  const formError = rootError(form, tv);
  const submitting = form.formState.isSubmitting;

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-lg border border-border bg-background-subtle p-6">
        <p className="text-lg font-semibold">{t("pages.contact.sentTitle")}</p>
        <p className="text-text-secondary">{t("pages.contact.sentBody", { email: sentTo })}</p>
        <Button asChild variant="outline">
          <a href={`/${lng}`}>{t("pages.contact.back")}</a>
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
      {formError ? <FormError>{formError}</FormError> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("pages.contact.nameLabel")} error={fieldError(form, "name", tv)} required>
          {(control) => (
            <Input autoComplete="name" placeholder={t("pages.contact.namePlaceholder")} {...control} {...form.register("name")} />
          )}
        </Field>

        <Field label={t("pages.contact.emailLabel")} error={fieldError(form, "email", tv)} required>
          {(control) => (
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("pages.contact.emailPlaceholder")}
              {...control}
              {...form.register("email")}
            />
          )}
        </Field>
      </div>

      <Field
        label={t("pages.contact.companyLabel")}
        description={t("pages.contact.companyHint")}
        error={fieldError(form, "company", tv)}
      >
        {(control) => <Input autoComplete="organization" {...control} {...form.register("company")} />}
      </Field>

      <Field label={t("pages.contact.messageLabel")} error={fieldError(form, "message", tv)} required>
        {(control) => (
          <Textarea rows={5} placeholder={t("pages.contact.messagePlaceholder")} {...control} {...form.register("message")} />
        )}
      </Field>

      <Button type="submit" size="lg" className="self-start" disabled={submitting}>
        {submitting ? t("pages.contact.submitting") : t("pages.contact.submit")}
      </Button>
    </form>
  );
}
