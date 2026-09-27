import { getT } from "next-i18next/server";

import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Logo } from "@trestle/ui/components/logo";

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

        <form className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-text-secondary">
              {t("login.emailLabel")}
            </label>
            <Input id="email" type="email" placeholder={t("login.emailPlaceholder")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="password" className="text-sm font-semibold text-text-secondary">
                {t("login.passwordLabel")}
              </label>
              <a href="#" className="text-sm text-action-primary hover:text-action-primaryHover">
                {t("login.forgotPassword")}
              </a>
            </div>
            <Input id="password" type="password" placeholder={t("login.passwordPlaceholder")} />
          </div>

          <Button type="submit" className="w-full">
            {t("login.signIn")}
          </Button>
        </form>

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
