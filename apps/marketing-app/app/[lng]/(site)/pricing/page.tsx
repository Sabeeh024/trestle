import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Button } from "@trestle/ui/components/ui/button";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@trestle/ui/components/ui/card";

import { appLink } from "@/lib/links";

const planKeys = ["free", "pro", "enterprise"] as const;

export default async function PricingPage() {
  const { t } = await getT("marketing");
  const locale = await lng();

  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="mb-12 text-center">
        <h1 className="text-3xl leading-heading font-bold">{t("pricing.title")}</h1>
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
