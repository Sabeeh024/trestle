import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { Button } from "@trestle/ui/components/ui/button";
import { Logo } from "@trestle/ui/components/logo";

import { appLink } from "@/lib/links";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT("marketing");
  const locale = await lng();
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-background text-text-primary">
      <header className="sticky top-0 z-sticky border-b border-border bg-background/85 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <a href={`/${locale}`}>
            <Logo />
          </a>

          <div className="hidden items-center gap-8 text-sm font-medium text-text-secondary md:flex">
            <a href={`/${locale}#features`} className="hover:text-text-primary">
              {t("nav.features")}
            </a>
            <a href={`/${locale}/pricing`} className="hover:text-text-primary">
              {t("nav.pricing")}
            </a>
            <a href={`/${locale}#faq`} className="hover:text-text-primary">
              {t("nav.faq")}
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a href={appLink(locale, "/login")} className="hidden text-sm font-semibold text-text-primary md:inline">
              {t("nav.logIn")}
            </a>
            <Button asChild size="sm">
              <a href={appLink(locale, "/signup")}>{t("nav.getStarted")}</a>
            </Button>
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border px-6 py-16">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-12 md:flex-row">
          <div className="flex max-w-60 flex-col gap-3">
            <Logo />
            <p className="text-sm text-text-secondary">{t("footer.tagline")}</p>
          </div>

          <div className="flex flex-wrap gap-16">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
                {t("footer.product.label")}
              </span>
              <a href={`/${locale}#features`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("footer.product.features")}
              </a>
              <a href={`/${locale}/pricing`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("footer.product.pricing")}
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
                {t("footer.company.label")}
              </span>
              <a href={`/${locale}/about`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("footer.company.about")}
              </a>
              <a href={`/${locale}/blog`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("footer.company.blog")}
              </a>
              <a href={`/${locale}/careers`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("footer.company.careers")}
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
                {t("footer.legal.label")}
              </span>
              <a href={`/${locale}/privacy`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("footer.legal.privacy")}
              </a>
              <a href={`/${locale}/terms`} className="text-sm text-text-secondary hover:text-text-primary">
                {t("footer.legal.terms")}
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-6xl border-t border-border pt-6 text-sm text-text-tertiary">
          {t("footer.copyright", { year })}
        </div>
      </footer>
    </div>
  );
}
