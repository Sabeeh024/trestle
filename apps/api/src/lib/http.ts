import type { Context } from "hono";
import { fieldErrors } from "@trestle/api-client/schemas";
import { sql, type SQL } from "drizzle-orm";
import type { z } from "zod";

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 501;

export function fail(c: Context, status: ErrorStatus, code: string, message: string, fields?: Record<string, string>) {
  return c.json({ error: { code, message, ...(fields ? { fields } : {}) } }, status);
}

export const notFound = (c: Context, what: string) => fail(c, 404, "not_found", `${what} not found`);
export const forbidden = (c: Context, message = "You do not have permission to do that") => fail(c, 403, "forbidden", message);
export const badRequest = (c: Context, message: string) => fail(c, 400, "bad_request", message);
export const emailTaken = (c: Context) => fail(c, 422, "validation_failed", "Some fields are invalid", { email: "emailTaken" });

export async function readBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

type Parsed<S extends z.ZodType> = { ok: true; data: z.infer<S> } | { ok: false; response: Response };

/** Validates a request body with a shared schema; on failure the response is a 422 with per-field message keys. */
export async function parseJson<S extends z.ZodType>(c: Context, schema: S): Promise<Parsed<S>> {
  const body = await readBody(c);
  const result = schema.safeParse(typeof body === "object" && body !== null ? body : {});
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, response: fail(c, 422, "validation_failed", "Some fields are invalid", fieldErrors(result.error)) };
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export interface Page {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

export function pageParams(c: Context): Page {
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(c.req.query("pageSize") ?? "20", 10) || 20));
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

/** A pattern for a case-insensitive "contains" search; %, _ and backslash in the input match literally. */
export const containsPattern = (q: string): string => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

export const ilike = (column: SQL | object, q: string): SQL => sql`${column} ilike ${containsPattern(q)}`;

export const iso = (date: Date) => date.toISOString();
export const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/** Unique-constraint violation, from either driver (drizzle wraps the driver error as `cause`). */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;
  return code === "23505";
}

const TASK_ID = /^TASK-(\d{1,9})$/i;
export const parseTaskId = (id: string): number | undefined => {
  const match = TASK_ID.exec(id);
  return match ? Number.parseInt(match[1]!, 10) : undefined;
};
export const taskKey = (id: number) => `TASK-${id}`;
