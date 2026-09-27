import { getT } from "next-i18next/server";

const planKeys = ["free", "pro", "enterprise"] as const;

export default async function PricingPage() {
  const { t } = await getT("marketing");

  return (
    <section>
      <h1>{t("pricing.title")}</h1>
      <p>{t("pricing.subtitle")}</p>
      {planKeys.map((key) => (
        <article key={key}>
          <h2>{t(`pricing.plans.${key}.name`)}</h2>
          <p>{t(`pricing.plans.${key}.description`)}</p>
          <p>
            {t(`pricing.plans.${key}.price`)}
            {t(`pricing.plans.${key}.period`)}
          </p>
          <a href="#">{t(`pricing.plans.${key}.cta`)}</a>
          <ul>
            {(t(`pricing.plans.${key}.features`, { returnObjects: true }) as string[]).map(
              (feature) => (
                <li key={feature}>{feature}</li>
              ),
            )}
          </ul>
        </article>
      ))}
    </section>
  );
}
