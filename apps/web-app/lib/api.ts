import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientHeadersForApi } from "@trestle/auth/request";
import { createApi, type Transport } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

import { SESSION_COOKIE } from "@/lib/session";

// Next memoizes identical GET fetches within a render, but every GraphQL operation is a POST, so that does not
// apply. React's cache does the same job: within one render an identical query is sent once, however many Server
// Components (the sidebar, top bar and page all ask for the current user) request it. Mutations are never shared.
const queriesThisRender = cache(() => new Map<string, Promise<unknown>>());

function dedupeQueries(transport: Transport): Transport {
  return {
    request<T>(config: Parameters<Transport["request"]>[0]) {
      const body = config.body as { query?: unknown } | undefined;
      if (typeof body?.query !== "string" || !body.query.trimStart().startsWith("query")) return transport.request<T>(config);
      const sent = queriesThisRender();
      const key = JSON.stringify(body);
      if (!sent.has(key)) sent.set(key, transport.request<T>(config));
      return sent.get(key) as Promise<T>;
    },
  };
}

function makeApi(onUnauthorized?: () => void) {
  return createApi(
    dedupeQueries(createFetchTransport({
      baseURL: process.env.API_URL ?? "http://localhost:4000",
      // Tells the API which visitor this is (see INTERNAL_API_KEY there), so its per-client limits and its list of
      // signed-in devices describe the visitor and not this server.
      getHeaders: async () => clientHeadersForApi(await headers(), process.env.INTERNAL_API_KEY),
      getToken: async () => (await cookies()).get(SESSION_COOKIE)?.value,
      ...(onUnauthorized ? { onUnauthorized } : {}),
    })),
  );
}

// Server-side API client, used by Server Components. It runs on the native fetch transport, and identical
// queries are sent once per render (see queriesThisRender). The signed-in user's token is read from the
// httpOnly session cookie on every request. A 401 means the session ended (signed out elsewhere, password changed,
// expired), so the person is sent to sign in again rather than shown an error.
export const api = makeApi(() => redirect("/session-expired"));

// For Server Actions that handle a 401 themselves: a wrong password is a 401 too, and must reach the form.
export const authApi = makeApi();
