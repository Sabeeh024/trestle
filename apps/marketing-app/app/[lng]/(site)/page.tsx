import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Button } from "@trestle/ui/components/ui/button";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@trestle/ui/components/ui/card";

import { appLink } from "@/lib/links";

const socialProofNames = ["Northwind", "Fontaine Co.", "Umbra Labs", "Verity", "Haldane"];

const featureKeys = ["tasks", "projects", "boards", "collaboration"] as const;

export default async function HomePage() {
  const { t } = await getT("marketing");
  const locale = await lng();

  return (
    <>
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="text-5xl leading-display font-extrabold tracking-tight">{t("hero.title")}</h1>
        <p className="max-w-xl text-lg leading-body text-text-secondary">{t("hero.subtitle")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <a href="#get-started">{t("hero.cta")}</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href="#demo">{t("hero.secondaryCta")}</a>
          </Button>
        </div>
        <div
          role="img"
          aria-label={t("hero.screenshotAlt")}
          className="mt-8 aspect-video w-full max-w-2xl rounded-lg border border-border bg-background-subtle"
        />
      </section>

      <section aria-label={t("socialProof.label")} className="border-y border-border bg-background-subtle py-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6">
          <p className="text-xs font-semibold tracking-wide text-text-disabled uppercase">{t("socialProof.label")}</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {socialProofNames.map((name) => (
              <li key={name} className="text-lg font-semibold text-text-secondary">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-5xl px-6 py-24">
        <h2 className="mb-12 text-center text-3xl leading-heading font-bold">{t("features.title")}</h2>
        <div className="grid gap-8 sm:grid-cols-2">
          {featureKeys.map((key) => (
            <article key={key} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-action-primary">{t(`features.${key}.eyebrow`)}</p>
              <h3 className="text-xl leading-heading font-semibold">{t(`features.${key}.title`)}</h3>
              <p className="text-text-secondary">{t(`features.${key}.description`)}</p>
              <div
                role="img"
                aria-label={t(`features.${key}.imageAlt`)}
                className="mt-4 aspect-4/3 rounded-lg border border-border bg-background-subtle"
              />
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-background-subtle px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl leading-heading font-bold">{t("whyTrestle.title")}</h2>
          <p className="mt-4 text-text-secondary">{t("whyTrestle.description")}</p>
        </div>
      </section>

      <PricingSection />

      <section id="faq" className="mx-auto max-w-3xl px-6 py-24">
        <h2 className="mb-8 text-center text-3xl leading-heading font-bold">{t("faq.title")}</h2>
        <div className="flex flex-col divide-y divide-border">
          {(t("faq.items", { returnObjects: true }) as { q: string; a: string }[]).map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="cursor-pointer list-none text-base font-semibold">{item.q}</summary>
              <p className="mt-2 text-text-secondary">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="get-started" className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
        <h2 className="text-3xl leading-heading font-bold">{t("finalCta.title")}</h2>
        <Button size="lg" asChild>
          <a href={appLink(locale, "/signup")}>{t("finalCta.cta")}</a>
        </Button>
      </section>
    </>
  );
}

async function PricingSection() {
  const { t } = await getT("marketing");
  const locale = await lng();
  const planKeys = ["free", "pro", "enterprise"] as const;

  return (
    <section id="pricing" className="mx-auto max-w-5xl px-6 py-24">
      <div className="mb-12 text-center">
        <h2 className="text-3xl leading-heading font-bold">{t("pricing.title")}</h2>
        <p className="mt-2 text-text-secondary">{t("pricing.subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {planKeys.map((key) => {
          const badge = t(`pricing.plans.${key}.badge`, { defaultValue: "" });
          return (
            <div key={key} className="relative">
              {badge ? (
                <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2" shape="pill">
                  {badge}
                </Badge>
              ) : null}
              <Card className={badge ? "border-action-primary" : undefined}>
                <CardHeader>
                  <CardTitle>{t(`pricing.plans.${key}.name`)}</CardTitle>
                  <CardDescription>{t(`pricing.plans.${key}.description`)}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <p className="text-3xl font-extrabold">
                    {t(`pricing.plans.${key}.price`)}
                    <span className="text-sm font-medium text-text-secondary">
                      {t(`pricing.plans.${key}.period`)}
                    </span>
                  </p>
                  <ul className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-text-secondary">
                    {(t(`pricing.plans.${key}.features`, { returnObjects: true }) as string[]).map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={badge ? "default" : "outline"} asChild>
                    <a href={key === "enterprise" ? `/${locale}/contact` : appLink(locale, "/signup")}>{t(`pricing.plans.${key}.cta`)}</a>
                  </Button>
                </CardFooter>
              </Card>
            </div>
          );
        })}
      </div>
    </section>
  );
}
