import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

export default async function NotFound() {
  const { t } = await getT("marketing");
  const locale = await lng();

  return (
    <section>
      <h1>{t("notFound.title")}</h1>
      <p>{t("notFound.description")}</p>
      <a href={`/${locale}`}>{t("notFound.cta")}</a>
    </section>
  );
}
