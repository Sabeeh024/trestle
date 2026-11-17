import { fieldErrors } from "@trestle/api-client/schemas";
import type { z } from "zod";

import { validationFailed } from "./errors";

/** Validates an operation's input with the shared schema (the one the forms use); failures carry per-field message keys. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(typeof value === "object" && value !== null ? value : {});
  if (!result.success) throw validationFailed(fieldErrors(result.error));
  return result.data;
}

/** GraphQL gives `null` for an input field sent as null and omits one that was not sent; the schemas treat only the latter as "unset". */
export const dropNulls = <T extends Record<string, unknown>>(input: T, keep: readonly string[] = []): T =>
  Object.fromEntries(Object.entries(input).filter(([key, value]) => value !== null || keep.includes(key))) as T;
