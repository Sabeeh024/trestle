import type { AuditAction, User, UserRole, UserSummary } from "@trestle/api-client/types";
import { eq, sql } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { readCookie, serializeSessionCookie, type SessionCookieOptions } from "@trestle/auth/cookie";
import { bearerToken, isTrustedWrite } from "@trestle/auth/request";

import type { Config } from "./config";
import { schema, type Db } from "./db";
import { fail, initials, iso, isoOrNull } from "./lib/http";
import type { Mailer } from "./lib/mailer";
import { hashToken, newToken } from "./lib/password";
import type { RateLimiter } from "./lib/rate-limit";

const { users, organizations, sessions, auditLog } = schema;

/** The signed-in user, as resolved from the session on each request. */
export interface Principal {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: UserRole;
  /** Belongs to the operator's own organization, so admin endpoints span every organization. */
  isPlatform: boolean;
  /** The session this request is using (not its token). */
  sessionId: string;
  /** How the session arrived: a bearer token, or the browser's cookie. */
  via: "bearer" | "cookie";
}

export type Env = { Variables: { me: Principal } };

export interface Deps {
  db: Db;
  mailer: Mailer;
  config: Pick<Config, "SESSION_TTL_DAYS" | "WEB_APP_URL" | "DEV_SSO" | "TRUST_PROXY" | "INTERNAL_API_KEY">;
  /** Throttles sign-in, sign-up, reset, invite and contact requests; false turns it off (tests). */
  limiter: RateLimiter | false;
  /** The browser origins allowed to call the API, which are also the only ones allowed to write with a cookie. */
  corsOrigins: string[];
  /** The session cookie, for clients that ask for one (the admin panel) instead of holding a token. */
  cookie: { name: string; options: SessionCookieOptions };
}

// last_active_at and last_used_at are only rewritten when older than this, so a busy client is not a write per request.
const ACTIVITY_GRANULARITY_MS = 5 * 60_000;

/**
 * This API's own origin as the browser addressed it (behind a proxy, from the headers the proxy sets). A page served
 * by the API itself, like the admin panel, writes from this origin, so it counts as ours without being configured.
 */
function ownOrigin(c: Context) {
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
  const protocol = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() ?? new URL(c.req.url).protocol.replace(":", "");
  return host ? `${protocol}://${host}` : "";
}

/**
 * Resolves the caller from `Authorization: Bearer <token>` (servers, which hold the token themselves) or from the
 * session cookie (browsers, where page scripts must not hold it). Cookies are sent automatically, so a write that
 * arrives by cookie must also come from one of our own origins.
 */
export const requireAuth =
  ({ db, cookie, corsOrigins }: Deps): MiddlewareHandler<Env> =>
  async (c, next) => {
    const bearer = bearerToken(c.req.header("authorization"));
    const fromCookie = bearer ? undefined : readCookie(c.req.header("cookie"), cookie.name);
    const token = bearer ?? fromCookie;
    if (!token) return fail(c, 401, "unauthenticated", "Sign in to continue");

    if (fromCookie && !isTrustedWrite({ method: c.req.method, origin: c.req.header("origin"), fetchSite: c.req.header("sec-fetch-site") }, [...corsOrigins, ownOrigin(c)])) {
      return fail(c, 403, "forbidden", "Cross-site request refused");
    }

    // One indexed lookup resolves the session, the user and whether their organization is the platform's.
    const [row] = await db
      .select({
        id: users.id,
        orgId: users.orgId,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        lastActiveAt: users.lastActiveAt,
        isPlatform: organizations.isPlatform,
        sessionId: sessions.id,
        sessionLastUsedAt: sessions.lastUsedAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(sql`${sessions.tokenHash} = ${hashToken(token)} and ${sessions.expiresAt} > now()`);

    if (!row || row.status === "suspended") return fail(c, 401, "unauthenticated", "Sign in to continue");

    const stale = (at: Date | null) => !at || Date.now() - at.getTime() > ACTIVITY_GRANULARITY_MS;
    if (stale(row.lastActiveAt)) await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, row.id));
    if (stale(row.sessionLastUsedAt)) await db.update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, row.sessionId));

    c.set("me", {
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      email: row.email,
      role: row.role,
      isPlatform: row.isPlatform,
      sessionId: row.sessionId,
      via: bearer ? "bearer" : "cookie",
    });
    await next();
  };

/** Viewers are read-only. */
export const canWrite = (me: Principal) => me.role !== "viewer";
export const isAdmin = (me: Principal) => me.role === "owner" || me.role === "admin";

export async function audit(
  db: Db,
  entry: { orgId: string | null; actor: string; action: AuditAction; target: string },
) {
  await db.insert(auditLog).values(entry);
}

type UserRow = typeof users.$inferSelect;

export function toUser(row: Pick<UserRow, "id" | "name" | "email" | "orgId" | "role" | "status" | "joinedAt" | "lastActiveAt"> & { orgName: string }): User {
  return {
    id: row.id,
    name: row.name,
    initials: initials(row.name),
    email: row.email,
    orgId: row.orgId,
    orgName: row.orgName,
    role: row.role,
    status: row.status,
    joinedAt: iso(row.joinedAt),
    lastActiveAt: isoOrNull(row.lastActiveAt),
  };
}

export const toSummary = (row: { id: string; name: string }): UserSummary => ({
  id: row.id,
  name: row.name,
  initials: initials(row.name),
});

export const userColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  orgId: users.orgId,
  // A scalar subquery, so any select, insert or update of a user can return it without a join.
  orgName: sql<string>`(select o.name from organizations o where o.id = "users"."org_id")`,
  role: users.role,
  status: users.status,
  joinedAt: users.joinedAt,
  lastActiveAt: users.lastActiveAt,
};

/** Creates a session and returns the raw token (only its hash is stored). */
export async function createSession(db: Db, userId: string, ttlDays: number, userAgent?: string | null) {
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.insert(sessions).values({ tokenHash: hash, userId, expiresAt, userAgent: userAgent?.slice(0, 300) ?? null });
  // Expired sessions are swept as people sign in, so the table never needs a separate cleanup job.
  await db.delete(sessions).where(sql`${sessions.expiresAt} < now()`);
  return token;
}

/**
 * Opens a session for a user who has just proven who they are. By default the token is in the response body, for
 * a server that keeps it. A client that sends `X-Auth-Mode: cookie` (a browser app with no server of its own)
 * instead gets an HttpOnly cookie and never sees the token; the custom header cannot be sent cross-site without
 * the CORS allowlist's permission, which is what keeps another site from signing a visitor in as someone else.
 */
export async function startSession(c: Context, { db, config, cookie }: Deps, user: User, status: 200 | 201 = 200) {
  const token = await createSession(db, user.id, config.SESSION_TTL_DAYS, c.req.header("user-agent"));
  if (c.req.header("x-auth-mode") === "cookie") {
    c.header("Set-Cookie", serializeSessionCookie(cookie.name, token, cookie.options));
    return c.json({ data: { token: null, user } }, status);
  }
  return c.json({ data: { token, user } }, status);
}
