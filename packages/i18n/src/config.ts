import { defaultLocale, locales } from "./locales";

// Framework-agnostic base shared by every app's own i18n.config.ts.
// Each app spreads this and adds its own `ns` and `resourceLoader`, since
// resourceLoader's dynamic import() must live in the app that owns the files.
export const baseI18nConfig = {
  supportedLngs: [...locales] as string[],
  fallbackLng: defaultLocale as string,
  localeParamName: "lng",
  defaultNS: "common",
};
