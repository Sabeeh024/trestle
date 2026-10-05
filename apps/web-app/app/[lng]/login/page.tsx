import { Suspense } from "react";
import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Button } from "@trestle/ui/components/ui/button";

import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";
import { SsoDialog } from "./sso-dialog";

export default async function LoginPage() {
  const { t } = await getT("app");
  const locale = await lng();

  return (
    <AuthCard title={t("login.title")} subtitle={t("login.subtitle")}>
      {/* useSearchParams in the form needs a Suspense boundary to keep this page prerendered. */}
      <Suspense>
        <LoginForm />
      </Suspense>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-tertiary">{t("login.or")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <SsoDialog>
        <Button variant="outline" className="w-full">
          {t("login.continueWithSso")}
        </Button>
      </SsoDialog>

      <p className="text-center text-sm text-text-secondary">
        {t("login.noAccount")}{" "}
        <a href={`/${locale}/signup`} className="font-semibold text-action-primary hover:text-action-primaryHover">
          {t("login.signUp")}
        </a>
      </p>
    </AuthCard>
  );
}
