import { createApi } from "@trestle/api-client";
import { createAxiosTransport } from "@trestle/api-client/axios";

import { markSignedOut } from "@/lib/session";

// The admin panel is a plain SPA, so it uses the axios transport, in cookie mode: the API sets an HttpOnly
// session cookie and the browser sends it, so the page never handles the token. The API and this panel must be
// on the same site (for example admin.example.com and api.example.com) for the cookie to be sent.
// A 401 means the session has ended: it is forgotten here, which sends the person back to the login screen.
export const api = createApi(
  createAxiosTransport({
    baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
    cookieSession: true,
    onUnauthorized: markSignedOut,
  }),
);
