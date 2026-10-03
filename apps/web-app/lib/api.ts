import { createApi } from "@trestle/api-client";
import { createFetchTransport } from "@trestle/api-client/fetch";

// Server-side API client, used by Server Components. It runs on the native fetch transport, so Next
// memoizes identical GETs within a render (the sidebar, top bar and page can all ask for the current
// user and it is requested once) and `next` caching options can be passed per call.
export const api = createApi(createFetchTransport({ baseURL: process.env.API_URL ?? "http://localhost:4000" }));
