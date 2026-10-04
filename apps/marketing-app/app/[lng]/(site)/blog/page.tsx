import { getT } from "next-i18next/server";

import { ContentPage } from "@/components/content-page";

export default async function BlogPage() {
  const { t } = await getT("marketing");

  return (
    <ContentPage title={t("pages.blog.title")} intro={t("pages.blog.intro")}>
      <p className="rounded-lg border border-dashed border-border p-8 text-center text-text-secondary">
        {t("pages.blog.empty")}
      </p>
    </ContentPage>
  );
}
