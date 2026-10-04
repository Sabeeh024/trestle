import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Button } from "@trestle/ui/components/ui/button";

import { ContentPage } from "@/components/content-page";

export default async function CareersPage() {
  const { t } = await getT("marketing");
  const locale = await lng();

  return (
    <ContentPage title={t("pages.careers.title")} intro={t("pages.careers.intro")}>
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-text-secondary">{t("pages.careers.empty")}</p>
        <Button asChild variant="outline">
          <a href={`/${locale}/contact`}>{t("pages.careers.cta")}</a>
        </Button>
      </div>
    </ContentPage>
  );
}
