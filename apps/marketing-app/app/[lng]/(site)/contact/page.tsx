import { getT } from "next-i18next/server";

import { ContentPage } from "@/components/content-page";
import { ContactForm } from "./contact-form";

export default async function ContactPage() {
  const { t } = await getT("marketing");

  return (
    <ContentPage title={t("pages.contact.title")} intro={t("pages.contact.intro")}>
      <ContactForm />
    </ContentPage>
  );
}
