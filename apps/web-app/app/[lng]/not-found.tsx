import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Button } from "@trestle/ui/components/ui/button";
import { Logo } from "@trestle/ui/components/logo";

export default async function NotFound() {
  const { t } = await getT("app");
  const locale = await lng();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-6 text-center text-text-primary">
      <Logo />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold tracking-wide text-action-primary uppercase">404</p>
        <h1 className="text-4xl leading-heading font-bold">{t("notFound.title")}</h1>
        <p className="max-w-sm text-text-secondary">{t("notFound.description")}</p>
      </div>

      <Button asChild>
        <a href={`/${locale}`}>{t("notFound.cta")}</a>
      </Button>
    </div>
  );
}
