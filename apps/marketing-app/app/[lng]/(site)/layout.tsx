import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT("marketing");
  const locale = await lng();
  const year = new Date().getFullYear();

  return (
    <>
      <header>
        <nav>
          <a href={`/${locale}`}>Trestle</a>
          <a href={`/${locale}#features`}>{t("nav.features")}</a>
          <a href={`/${locale}/pricing`}>{t("nav.pricing")}</a>
          <a href={`/${locale}#faq`}>{t("nav.faq")}</a>
          <a href="#">{t("nav.logIn")}</a>
          <a href="#">{t("nav.getStarted")}</a>
        </nav>
      </header>

      <main>{children}</main>

      <footer>
        <p>{t("footer.tagline")}</p>

        <div>
          <span>{t("footer.product.label")}</span>
          <a href={`/${locale}#features`}>{t("footer.product.features")}</a>
          <a href={`/${locale}/pricing`}>{t("footer.product.pricing")}</a>
        </div>

        <div>
          <span>{t("footer.company.label")}</span>
          <a href="#">{t("footer.company.about")}</a>
          <a href="#">{t("footer.company.blog")}</a>
          <a href="#">{t("footer.company.careers")}</a>
        </div>

        <div>
          <span>{t("footer.legal.label")}</span>
          <a href={`/${locale}/privacy`}>{t("footer.legal.privacy")}</a>
          <a href={`/${locale}/terms`}>{t("footer.legal.terms")}</a>
        </div>

        <p>{t("footer.copyright", { year })}</p>
      </footer>
    </>
  );
}
