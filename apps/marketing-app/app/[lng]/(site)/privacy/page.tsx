import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { ContentPage, ContentSection } from "@/components/content-page";
import { formatLongDate, LEGAL_LAST_UPDATED } from "@/lib/content";

export default async function PrivacyPage() {
  const { t } = await getT("marketing");
  const locale = await lng();

  return (
    <ContentPage
      title={t("pages.privacy.title")}
      intro={t("pages.privacy.intro")}
      updated={t("pages.updated", { date: formatLongDate(LEGAL_LAST_UPDATED, locale) })}
    >
      <ContentSection title={t("pages.privacy.collectTitle")}>{t("pages.privacy.collectBody")}</ContentSection>
      <ContentSection title={t("pages.privacy.useTitle")}>{t("pages.privacy.useBody")}</ContentSection>
      <ContentSection title={t("pages.privacy.rightsTitle")}>{t("pages.privacy.rightsBody")}</ContentSection>
    </ContentPage>
  );
}
