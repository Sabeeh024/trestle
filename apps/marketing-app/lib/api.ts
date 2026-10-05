import { headers } from "next/headers";
import { clientHeadersForApi } from "@trestle/auth/request";
import { createApi } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

// Server-side API client for Server Actions. The marketing site has no signed-in users, so no token. It does tell
// the API which visitor a request is for (see INTERNAL_API_KEY there), so the contact form's per-client limit
// counts that visitor and not this server.
export const api = createApi(
  createFetchTransport({
    baseURL: process.env.API_URL ?? "http://localhost:4000",
    getHeaders: async () => clientHeadersForApi(await headers(), process.env.INTERNAL_API_KEY),
  }),
);
