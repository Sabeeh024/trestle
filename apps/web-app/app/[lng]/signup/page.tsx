import { getT } from "next-i18next/server";
import { lng } from "next/root-params";

import { AuthCard } from "@/components/auth-card";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const { t } = await getT("app");
  const locale = await lng();

  return (
    <AuthCard title={t("signup.title")} subtitle={t("signup.subtitle")}>
      <SignupForm />

      <p className="text-center text-sm text-text-secondary">
        {t("signup.haveAccount")}{" "}
        <a href={`/${locale}/login`} className="font-semibold text-action-primary hover:text-action-primaryHover">
          {t("signup.signIn")}
        </a>
      </p>
    </AuthCard>
  );
}
