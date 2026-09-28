---
"@trestle/i18n": minor
---

Initial release of the shared i18n package:

- Locale list, default locale, and an `isLocale` type guard
- `getDirection` for RTL, marking Urdu as right-to-left
- Shared `common` and `domain` messages in English and Urdu
- `createI18n`, an i18next factory that merges an app's own messages over
  the shared ones and falls back to English for missing keys
- `baseI18nConfig`, a framework-agnostic base (locales, fallback,
  `localeParamName`, `defaultNS`) that Next apps spread into their own
  `next-i18next` config alongside an app-local `resourceLoader`
- `domain.json`'s task status values live under `taskStatus` (was
  `status`), alongside a new `projectStatus` group, since a task's status
  and a project's status are different concepts
