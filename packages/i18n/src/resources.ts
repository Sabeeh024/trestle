import type { ResourceLanguage } from "i18next";

import enCommon from "./messages/en/common.json";
import enDomain from "./messages/en/domain.json";
import enValidation from "./messages/en/validation.json";
import urCommon from "./messages/ur/common.json";
import urDomain from "./messages/ur/domain.json";
import urValidation from "./messages/ur/validation.json";
import type { Locale } from "./locales";

export const sharedResources = {
  en: { common: enCommon, domain: enDomain, validation: enValidation },
  ur: { common: urCommon, domain: urDomain, validation: urValidation },
} satisfies Record<Locale, ResourceLanguage>;