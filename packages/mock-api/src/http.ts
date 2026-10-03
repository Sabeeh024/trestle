import type { Context } from "hono";

import type { Paginated } from "@trestle/api-client/types";

export function fail(c: Context, status: 400 | 401 | 403 | 404 | 409, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

export const notFound = (c: Context, what: string) => fail(c, 404, "not_found", `${what} not found`);
export const badRequest = (c: Context, message: string) => fail(c, 400, "bad_request", message);

export async function readBody(c: Context): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await c.req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function matches(q: string | undefined, ...fields: (string | null | undefined)[]) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

export function paginate<T>(c: Context, items: T[]): Paginated<T> {
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(c.req.query("pageSize") ?? "20", 10) || 20));
  const start = (page - 1) * pageSize;
  return { data: items.slice(start, start + pageSize), meta: { page, pageSize, total: items.length } };
}

export function sortBy<T>(items: T[], key: keyof T & string, direction: string | undefined) {
  const factor = direction === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    const left = String(a[key] ?? "");
    const right = String(b[key] ?? "");
    return left.localeCompare(right) * factor;
  });
}
