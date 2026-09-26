import { createInstance, type i18n, type Resource, type ResourceLanguage } from "i18next";

import { defaultLocale, locales, type Locale } from "./locales";
import { sharedResources } from "./resources";

export type AppResources = Partial<Record<Locale, ResourceLanguage>>;

export function createI18n({
  locale,
  resources = {},
}: {
  locale: Locale;
  resources?: AppResources;
}): i18n {
  const merged: Resource = {};
  for (const l of locales) {
    merged[l] = { ...sharedResources[l], ...resources[l] };
  }

  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: defaultLocale,
    supportedLngs: [...locales],
    resources: merged,
    ns: Object.keys(merged[locale] ?? {}),
    defaultNS: "common",
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}