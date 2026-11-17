import { getQueryClient, queryKeys } from "@trestle/api-client/query";
import { useMe } from "@trestle/api-client/react";
import type { User } from "@trestle/api-client/types";

// The panel holds no token. The API keeps the session in an HttpOnly cookie that page scripts cannot read, so
// "am I signed in?" is answered by asking the API who the cookie belongs to (the `me` query). A null in that
// cache entry means "known to be signed out", which is what a 401 or a sign-out leaves behind.

// Earlier versions kept a token in localStorage. Any that is still there belongs to a session that is valid on the
// server and readable by page scripts, so it is removed (and the session it names is simply left to expire).
try {
  localStorage.removeItem("trestle-admin-token");
} catch {
  // Storage can be unavailable (private windows); there is then nothing to remove.
}

/** Records a fresh sign-in. Nothing cached from before it (another person's data) may be shown. */
export function startSession(user: User) {
  const queryClient = getQueryClient();
  queryClient.clear();
  queryClient.setQueryData(queryKeys.me, user);
}

/** Forgets the session locally: the cache is emptied and `me` is marked as signed out, without refetching it. */
export function markSignedOut() {
  const queryClient = getQueryClient();
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.me[0] });
  queryClient.setQueryData(queryKeys.me, null);
}

export type Session = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; user: User };

export function useSession(): Session {
  const me = useMe();
  if (me.data) return { status: "signed-in", user: me.data };
  if (me.isPending) return { status: "loading" };
  return { status: "signed-out" };
}
