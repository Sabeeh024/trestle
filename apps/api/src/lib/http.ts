import type { Context } from "hono";
import { sql, type SQL } from "drizzle-orm";

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 501;

export function fail(c: Context, status: ErrorStatus, code: string, message: string, fields?: Record<string, string>) {
  return c.json({ error: { code, message, ...(fields ? { fields } : {}) } }, status);
}

export const notFound = (c: Context, what: string) => fail(c, 404, "not_found", `${what} not found`);

export interface Page {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

/** A page request clamped to sane bounds: page from 1, pageSize 1 to 100 (default 20). */
export function pageFrom({ page: wantedPage, pageSize: wantedSize }: { page?: number | null | undefined; pageSize?: number | null | undefined } = {}): Page {
  const page = Math.max(1, Math.trunc(wantedPage ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(wantedSize ?? 20) || 20));
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);
