import type { Context } from "hono";

import type { Deps, Principal } from "../context";

/** What every resolver receives: the app's dependencies, the HTTP request, and the caller (resolved on first use). */
export interface GqlContext {
  deps: Deps;
  http: Context;
  /** The signed-in caller, or an `unauthenticated` error. Resolved once per request, however many fields ask. */
  me(): Promise<Principal>;
}
