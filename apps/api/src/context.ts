import type { AuditAction, User, UserRole, UserSummary } from "@trestle/api-client/types";
import { eq, sql } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";

import type { Config } from "./config";
import { schema, type Db } from "./db";
import { fail, initials, iso, isoOrNull } from "./lib/http";
import type { Mailer } from "./lib/mailer";
import { hashToken, newToken } from "./lib/password";
import type { RateLimiter } from "./lib/rate-limit";

const { users, organizations, sessions, auditLog } = schema;

/** The signed-in user, as resolved from the bearer token on each request. */
export interface Principal {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: UserRole;
  /** Belongs to the operator's own organization, so admin endpoints span every organization. */
  isPlatform: boolean;
}

export type Env = { Variables: { me: Principal } };

export interface Deps {
  db: Db;
  mailer: Mailer;
  config: Pick<Config, "SESSION_TTL_DAYS" | "WEB_APP_URL" | "DEV_SSO">;
  /** Throttles login attempts per client and address; false turns it off. */
  loginLimiter: RateLimiter | false;
}

// last_active_at is only rewritten when it is older than this, so a busy client is not a write per request.
const ACTIVITY_GRANULARITY_MS = 5 * 60_000;

export const requireAuth =
  ({ db }: Deps): MiddlewareHandler<Env> =>
  async (c, next) => {
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return fail(c, 401, "unauthenticated", "Sign in to continue");

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
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(sql`${sessions.tokenHash} = ${hashToken(token)} and ${sessions.expiresAt} > now()`);

    if (!row || row.status === "suspended") return fail(c, 401, "unauthenticated", "Sign in to continue");

    if (!row.lastActiveAt || Date.now() - row.lastActiveAt.getTime() > ACTIVITY_GRANULARITY_MS) {
      await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, row.id));
    }

    c.set("me", { id: row.id, orgId: row.orgId, name: row.name, email: row.email, role: row.role, isPlatform: row.isPlatform });
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
export async function createSession(db: Db, userId: string, ttlDays: number) {
  const { token, hash } = newToken();
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000);
  await db.insert(sessions).values({ tokenHash: hash, userId, expiresAt });
  // Expired sessions are swept as people sign in, so the table never needs a separate cleanup job.
  await db.delete(sessions).where(sql`${sessions.expiresAt} < now()`);
  return token;
}
