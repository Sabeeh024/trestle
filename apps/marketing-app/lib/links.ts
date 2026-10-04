// The product app lives on its own origin; the marketing site only links to it.
const APP_URL = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const appLink = (locale: string, path: "/login" | "/signup") => `${APP_URL}/${locale}${path}`;
