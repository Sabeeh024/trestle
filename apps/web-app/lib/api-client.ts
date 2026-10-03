import { createApi } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

// Browser-side API client, used by React Query hooks in Client Components. NEXT_PUBLIC_ is required
// for the URL to reach the browser bundle.
export const clientApi = createApi(
  createFetchTransport({ baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000", timeoutMs: 15_000 }),
);
