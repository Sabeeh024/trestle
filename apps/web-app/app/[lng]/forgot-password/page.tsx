import { getT } from "next-i18next/server";

import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const { t } = await getT("app");

  return (
    <AuthCard title={t("forgotPassword.title")} subtitle={t("forgotPassword.subtitle")}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
