import { getT } from "next-i18next/server";

const socialProofNames = ["Northwind", "Fontaine Co.", "Umbra Labs", "Verity", "Haldane"];

const featureKeys = ["tasks", "projects", "boards", "collaboration"] as const;

export default async function HomePage() {
  const { t } = await getT("marketing");

  return (
    <>
      <section>
        <h1>{t("hero.title")}</h1>
        <p>{t("hero.subtitle")}</p>
        <a href="#get-started">{t("hero.cta")}</a>
        <a href="#demo">{t("hero.secondaryCta")}</a>
        <div role="img" aria-label={t("hero.screenshotAlt")} />
      </section>

      <section aria-label={t("socialProof.label")}>
        <p>{t("socialProof.label")}</p>
        <ul>
          {socialProofNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </section>

      <section id="features">
        <h2>{t("features.title")}</h2>
        {featureKeys.map((key) => (
          <article key={key}>
            <p>{t(`features.${key}.eyebrow`)}</p>
            <h3>{t(`features.${key}.title`)}</h3>
            <p>{t(`features.${key}.description`)}</p>
            <div role="img" aria-label={t(`features.${key}.imageAlt`)} />
          </article>
        ))}
      </section>

      <section>
        <h2>{t("whyTrestle.title")}</h2>
        <p>{t("whyTrestle.description")}</p>
      </section>

      <PricingSection />

      <section id="faq">
        <h2>{t("faq.title")}</h2>
        {(t("faq.items", { returnObjects: true }) as { q: string; a: string }[]).map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </section>

      <section id="get-started">
        <h2>{t("finalCta.title")}</h2>
        <a href="#">{t("finalCta.cta")}</a>
      </section>
    </>
  );
}

async function PricingSection() {
  const { t } = await getT("marketing");
  const planKeys = ["free", "pro", "enterprise"] as const;

  return (
    <section id="pricing">
      <h2>{t("pricing.title")}</h2>
      <p>{t("pricing.subtitle")}</p>
      {planKeys.map((key) => (
        <article key={key}>
          <h3>{t(`pricing.plans.${key}.name`)}</h3>
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
