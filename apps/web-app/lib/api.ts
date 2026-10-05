import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientHeadersForApi } from "@trestle/auth/request";
import { createApi } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

import { SESSION_COOKIE } from "@/lib/session";

function makeApi(onUnauthorized?: () => void) {
  return createApi(
    createFetchTransport({
      baseURL: process.env.API_URL ?? "http://localhost:4000",
      // Tells the API which visitor this is (see INTERNAL_API_KEY there), so its per-client limits and its list of
      // signed-in devices describe the visitor and not this server.
      getHeaders: async () => clientHeadersForApi(await headers(), process.env.INTERNAL_API_KEY),
      getToken: async () => (await cookies()).get(SESSION_COOKIE)?.value,
      ...(onUnauthorized ? { onUnauthorized } : {}),
    }),
  );
}

// Server-side API client, used by Server Components. It runs on the native fetch transport, so Next memoizes
// identical GETs within a render (the sidebar, top bar and page can all ask for the current user and it is
// requested once) and `next` caching options can be passed per call. The signed-in user's token is read from the
// httpOnly session cookie on every request. A 401 means the session ended (signed out elsewhere, password changed,
// expired), so the person is sent to sign in again rather than shown an error.
export const api = makeApi(() => redirect("/session-expired"));

// For Server Actions that handle a 401 themselves: a wrong password is a 401 too, and must reach the form.
export const authApi = makeApi();
