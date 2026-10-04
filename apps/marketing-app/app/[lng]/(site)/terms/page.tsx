import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { ContentPage, ContentSection } from "@/components/content-page";
import { formatLongDate, LEGAL_LAST_UPDATED } from "@/lib/content";

export default async function TermsPage() {
  const { t } = await getT("marketing");
  const locale = await lng();

  return (
    <ContentPage
      title={t("pages.terms.title")}
      intro={t("pages.terms.intro")}
      updated={t("pages.updated", { date: formatLongDate(LEGAL_LAST_UPDATED, locale) })}
    >
      <ContentSection title={t("pages.terms.useTitle")}>{t("pages.terms.useBody")}</ContentSection>
      <ContentSection title={t("pages.terms.accountsTitle")}>{t("pages.terms.accountsBody")}</ContentSection>
      <ContentSection title={t("pages.terms.changesTitle")}>{t("pages.terms.changesBody")}</ContentSection>
    </ContentPage>
  );
}
