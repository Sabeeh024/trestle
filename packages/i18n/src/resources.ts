import type { ResourceLanguage } from "i18next";

import enCommon from "./messages/en/common.json";
import enDomain from "./messages/en/domain.json";
import urCommon from "./messages/ur/common.json";
import urDomain from "./messages/ur/domain.json";
import type { Locale } from "./locales";

export const sharedResources = {
  en: { common: enCommon, domain: enDomain },
  ur: { common: urCommon, domain: urDomain },
} satisfies Record<Locale, ResourceLanguage>;