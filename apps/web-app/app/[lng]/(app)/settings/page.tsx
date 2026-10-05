import { getT } from "next-i18next/server";

import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { api } from "@/lib/api";
import { LanguageSwitcher } from "./language-switcher";
import { PasswordForm } from "./password-form";
import { SessionsList } from "./sessions-list";
import { ProfileForm } from "./profile-form";
import { ThemeSwitcher } from "./theme-switcher";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-background-subtle p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const { t } = await getT("app");
  const [me, sessions] = await Promise.all([api.auth.me(), api.auth.sessions.list()]);

  return (
    <>
      <Sidebar active="settings" />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={[t("settings.title")]} />

        <div className="flex max-w-2xl flex-col gap-6 p-8">
          <h1 className="text-2xl leading-heading font-bold">{t("settings.title")}</h1>

          <Section title={t("settings.profile.title")} description={t("settings.profile.description")}>
            <ProfileForm name={me.name} email={me.email} />
          </Section>

          <Section title={t("settings.security.title")} description={t("settings.security.description")}>
            <PasswordForm />
          </Section>

          <Section title={t("settings.security.sessionsTitle")} description={t("settings.security.sessionsDescription")}>
            <SessionsList sessions={sessions} />
          </Section>

          <Section title={t("settings.appearance.title")} description={t("settings.appearance.description")}>
            <ThemeSwitcher />
          </Section>

          <Section title={t("settings.language.title")} description={t("settings.language.description")}>
            <LanguageSwitcher />
          </Section>
        </div>
      </main>
    </>
  );
}
