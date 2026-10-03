import type { I18nConfig } from "next-i18next/proxy";
import { baseI18nConfig, locales, sharedResources } from "@trestle/i18n";

const i18nConfig: I18nConfig = {
  ...baseI18nConfig,
  ns: ["common", "domain", "validation", "app"],
  resourceLoader: (language, namespace) => {
    const lang = language as (typeof locales)[number];
    if (namespace === "common" || namespace === "domain" || namespace === "validation") {
      return Promise.resolve(sharedResources[lang][namespace]);
    }
    return import(`./app/i18n/locales/${lang}/${namespace}.json`);
  },
};

export default i18nConfig;
