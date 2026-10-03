import { cookies } from "next/headers";
import { createApi } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

import { SESSION_COOKIE } from "@/lib/session";

// Server-side API client, used by Server Components and Server Actions. It runs on the native fetch
// transport, so Next memoizes identical GETs within a render (the sidebar, top bar and page can all
// ask for the current user and it is requested once) and `next` caching options can be passed per call.
// The signed-in user's token is read from the httpOnly session cookie on every request.
export const api = createApi(
  createFetchTransport({
    baseURL: process.env.API_URL ?? "http://localhost:4000",
    getToken: async () => (await cookies()).get(SESSION_COOKIE)?.value,
  }),
);
