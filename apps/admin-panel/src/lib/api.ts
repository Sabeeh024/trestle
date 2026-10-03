import { createApi } from "@trestle/api-client";
import { createAxiosTransport } from "@trestle/api-client/axios";

// The admin panel is a plain SPA, so it uses the axios transport. There is no sign-in flow yet,
// which is why no getToken is passed.
export const api = createApi(
  createAxiosTransport({ baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000" }),
);
