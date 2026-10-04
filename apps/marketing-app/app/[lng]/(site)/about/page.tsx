import { getT } from "next-i18next/server";

import { ContentPage, ContentSection } from "@/components/content-page";

export default async function AboutPage() {
  const { t } = await getT("marketing");

  return (
    <ContentPage title={t("pages.about.title")} intro={t("pages.about.intro")}>
      <ContentSection title={t("pages.about.missionTitle")}>{t("pages.about.missionBody")}</ContentSection>
      <ContentSection title={t("pages.about.valuesTitle")}>{t("pages.about.valuesBody")}</ContentSection>
    </ContentPage>
  );
}
