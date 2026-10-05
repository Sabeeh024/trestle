import { sessionCookieName, sessionCookieOptions } from "@trestle/auth/cookie";

const production = process.env.NODE_ENV === "production";

// The session token lives in this cookie. In production it is `__Host-` prefixed, so browsers only accept it
// when it is Secure, site-wide and host-only, and nothing on a sibling subdomain can overwrite it.
export const SESSION_COOKIE = sessionCookieName(production);

// Kept as long as the API keeps the session (SESSION_TTL_DAYS there), so the cookie does not outlive it.
export const SESSION_COOKIE_OPTIONS = sessionCookieOptions({
  secure: production,
  ttlDays: Number(process.env.SESSION_TTL_DAYS ?? 30),
});

// Sections a signed-out visitor may open; every other page needs a session.
export const PUBLIC_SECTIONS = new Set(["login", "signup", "forgot-password", "reset-password", "session-expired"]);
