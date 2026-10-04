import { createApi } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

// Server-side API client for Server Actions. The marketing site has no signed-in users, so no token.
export const api = createApi(createFetchTransport({ baseURL: process.env.API_URL ?? "http://localhost:4000" }));
