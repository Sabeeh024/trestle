import { cookies } from "next/headers";

import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";

/** Stores the API's session token in the browser's cookie. */
export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
}

/**
 * Removes the cookie. A `__Host-` cookie can only be replaced by a Set-Cookie that is also Secure and site-wide, so
 * this sends the same attributes with an immediate expiry; `cookies().delete()` would leave them out and the
 * browser would ignore it.
 */
export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
}
