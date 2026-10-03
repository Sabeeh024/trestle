import { getT } from "next-i18next/server";

import { Button } from "@trestle/ui/components/ui/button";
import { Logo } from "@trestle/ui/components/logo";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const { t } = await getT("app");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-subtle px-6">
      <div className="flex w-full max-w-100 flex-col gap-5 rounded-xl border border-border bg-background p-10 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          <Logo wordmark={false} size="lg" />
          <div className="text-center">
            <h1 className="text-2xl leading-heading font-bold">{t("login.title")}</h1>
            <p className="mt-1 text-sm text-text-secondary">{t("login.subtitle")}</p>
          </div>
        </div>

        <LoginForm />

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-text-disabled">{t("login.or")}</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full">
          {t("login.continueWithSso")}
        </Button>

        <p className="text-center text-sm text-text-secondary">
          {t("login.noAccount")}{" "}
          <a href="#" className="font-semibold text-action-primary hover:text-action-primaryHover">
            {t("login.signUp")}
          </a>
        </p>
      </div>
    </div>
  );
}
