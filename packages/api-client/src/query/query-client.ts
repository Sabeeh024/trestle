import { defaultShouldDehydrateQuery, isServer, QueryClient } from "@tanstack/react-query";

import { isApiError } from "../errors";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Above zero so a server-prefetched query is not refetched the moment the client hydrates it.
        staleTime: 60_000,
        retry: (failureCount, error) => {
          // 4xx responses will not succeed on retry; only retry transient failures.
          if (isApiError(error) && error.status !== null && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      dehydrate: {
        // Include in-flight queries so a Server Component can stream a prefetch it did not await.
        shouldDehydrateQuery: (query) => defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/**
 * On the server this returns a new client per call, so one user's cached data is never served to
 * another. In the browser it returns a single shared client, so React suspending during the first
 * render does not throw the cache away.
 */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}
