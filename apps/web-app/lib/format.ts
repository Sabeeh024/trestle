// Date-only values ("2026-10-10") are UTC midnight, so format them in UTC or they can show the day before.
export function formatDate(iso: string | null, locale: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(iso));
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatRelative(iso: string, locale: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return formatter.format(Math.trunc(seconds / size), unit);
  }
  return formatter.format(0, "second");
}

/** Today's date as YYYY-MM-DD in UTC, comparable with the API's date-only due dates. */
export const todayIso = () => new Date().toISOString().slice(0, 10);
