import { createApi } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

// Browser-side API client, used by React Query hooks in Client Components. It talks to this app's own
// /api/bff route, which adds the session token from the httpOnly cookie. In the browser the base is the
// page's own origin; on the server it is never used, because React Query only fetches in the browser.
const origin = typeof window === "undefined" ? "http://localhost:3000" : window.location.origin;

export const clientApi = createApi(createFetchTransport({ baseURL: `${origin}/api/bff`, timeoutMs: 15_000 }));
