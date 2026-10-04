import { createApi } from "@trestle/api-client";
import { createAxiosTransport } from "@trestle/api-client/axios";
import { getQueryClient } from "@trestle/api-client/query";

import { clearToken, getToken } from "@/lib/session";

// The admin panel is a plain SPA, so it uses the axios transport. A 401 means the token is no longer
// good: clearing it sends the person back to the login screen, and clearing the cache means the next
// person to sign in on this browser never sees the previous one's data.
export const api = createApi(
  createAxiosTransport({
    baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000",
    getToken,
    onUnauthorized: () => {
      clearToken();
      getQueryClient().clear();
    },
  }),
);
