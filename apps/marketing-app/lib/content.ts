// When the Privacy Policy and Terms of Service were last revised.
export const LEGAL_LAST_UPDATED = "2026-10-04";

export function formatLongDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date(iso));
}
