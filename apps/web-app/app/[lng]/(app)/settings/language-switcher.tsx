"use client";

import { usePathname, useRouter } from "next/navigation";
import { useT } from "next-i18next/client";

import { locales } from "@trestle/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trestle/ui/components/ui/select";
import { Label } from "@trestle/ui/components/ui/label";

// Each language is named in itself, so someone who cannot read the current one can still find theirs.
const languageNames: Record<(typeof locales)[number], string> = { en: "English", ur: "اردو" };

export function LanguageSwitcher() {
  const { t, i18n } = useT("app");
  const router = useRouter();
  const pathname = usePathname();

  function change(next: string) {
    // The language is the first path segment, so switching means opening the same page under another one.
    router.push(pathname.replace(/^\/[^/]+/, `/${next}`));
  }

  return (
    <div className="flex max-w-xs flex-col gap-1.5">
      <Label htmlFor="language">{t("settings.language.label")}</Label>
      <Select value={i18n.language} onValueChange={change}>
        <SelectTrigger id="language" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((locale) => (
            <SelectItem key={locale} value={locale} lang={locale}>
              {languageNames[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
