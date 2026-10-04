import Link from "next/link";
import { getT } from "next-i18next/server";

import { Button } from "@trestle/ui/components/ui/button";

import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ lng: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [{ lng }, { token }, { t }] = await Promise.all([params, searchParams, getT("app")]);
  const value = Array.isArray(token) ? token[0] : token;

  return (
    <AuthCard title={t("resetPassword.title")} subtitle={t("resetPassword.subtitle")}>
      {value ? (
        <ResetPasswordForm token={value} />
      ) : (
        <div className="flex flex-col gap-4 text-center" role="alert">
          <p className="text-sm text-text-secondary">{t("resetPassword.missingToken")}</p>
          <Button asChild className="w-full">
            <Link href={`/${lng}/forgot-password`}>{t("resetPassword.requestNew")}</Link>
          </Button>
        </div>
      )}
    </AuthCard>
  );
}
