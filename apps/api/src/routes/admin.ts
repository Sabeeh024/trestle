import {
  createOrganizationSchema,
  inviteUserSchema,
  updateOrganizationSchema,
  updateUserSchema,
} from "@trestle/api-client/schemas";
import type { AdminUser, AuditAction, AuditLogEntry, Organization, UserRole, UserStatus } from "@trestle/api-client/types";
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { z } from "zod";

import { isAdmin, requireAuth, toUser, userColumns, type Deps, type Env, type Principal } from "../context";
import { schema } from "../db";
import { badRequest, fail, forbidden, ilike, iso, isUniqueViolation, emailTaken, notFound, oneOf, pageParams, parseJson, readBody } from "../lib/http";
import { enforce, limits } from "../lib/rate-limit";
import { sendPasswordLink } from "../lib/password-links";
import { isUuid } from "./tasks";

const { users, organizations, auditLog, sessions } = schema;

const USER_SORT = {
  name: sql`lower(${users.name})`,
  email: sql`lower(${users.email})`,
  role: sql`${users.role}::text`,
  status: sql`${users.status}::text`,
  joinedAt: sql`${users.joinedAt}`,
} as const;

const bulkSchema = z.object({ action: z.enum(["suspend", "delete"]), ids: z.array(z.string()).min(1).max(200) });

/** Platform admins see every organization; everyone else's admin access ends at their own organization. */
const scopeOrg = (me: Principal) => (me.isPlatform ? undefined : me.orgId);

// Qualified by hand: drizzle renders a lone-table column unqualified, which inside the subquery would mean users.id.
const memberCount = sql<number>`(select count(*) from users u where u.org_id = "organizations"."id")`.mapWith(Number);
const orgColumns = {
  id: organizations.id,
  name: organizations.name,
  plan: organizations.plan,
  status: organizations.status,
  createdAt: organizations.createdAt,
  memberCount,
};

const toOrganization = (r: { id: string; name: string; plan: Organization["plan"]; status: Organization["status"]; createdAt: Date; memberCount: number }): Organization => ({
  ...r,
  createdAt: iso(r.createdAt),
});

const adminUserColumns = { ...userColumns, orgName: organizations.name };
const toAdminUser = (r: Parameters<typeof toUser>[0]): AdminUser => toUser(r);

export function adminRoutes(deps: Deps) {
  const { db } = deps;
  const app = new Hono<Env>();
  app.use("*", requireAuth(deps));
  app.use("*", async (c, next) => {
    if (!isAdmin(c.get("me"))) return fail(c, 403, "forbidden", "Admin access required");
    await next();
  });

  const findUser = async (me: Principal, id: string) => {
    if (!isUuid(id)) return undefined;
    const [row] = await db
      .select(adminUserColumns)
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(and(eq(users.id, id), scopeOrg(me) ? eq(users.orgId, me.orgId) : undefined));
    return row;
  };

  const log = (me: Principal, orgId: string, action: AuditAction, target: string) =>
    db.insert(auditLog).values({ orgId, actor: me.email, action, target });

  /** Owners can only be changed by owners, and an organization is never left without one. */
  async function guardOwner(c: Context, me: Principal, targets: { id: string; orgId: string; role: UserRole }[], leaving = targets) {
    const owners = targets.filter((t) => t.role === "owner");
    if (owners.length === 0) return undefined;
    if (me.role !== "owner") return forbidden(c, "Only an owner can change an owner");

    const leavingIds = new Set(leaving.filter((t) => t.role === "owner").map((t) => t.id));
    for (const orgId of new Set(owners.map((o) => o.orgId))) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.orgId, orgId), eq(users.role, "owner"), ne(users.status, "suspended")));
      if (rows.every((r) => leavingIds.has(r.id))) return fail(c, 409, "last_owner", "An organization needs at least one active owner");
    }
    return undefined;
  }

  // ---- Users ----

  app.get("/users", async (c) => {
    const me = c.get("me");
    const { limit, offset, page, pageSize } = pageParams(c);
    const q = c.req.query("q")?.trim();
    const role = oneOf(c.req.query("role"), schema.userRole.enumValues);
    const status = oneOf(c.req.query("status"), schema.userStatus.enumValues);
    const orgId = c.req.query("orgId");
    const sortKey = oneOf(c.req.query("sort"), Object.keys(USER_SORT) as (keyof typeof USER_SORT)[]) ?? "name";
    const order = c.req.query("direction") === "desc" ? desc : asc;

    const scope = scopeOrg(me);
    const where = and(
      scope ? eq(users.orgId, scope) : orgId ? (isUuid(orgId) ? eq(users.orgId, orgId) : sql`false`) : undefined,
      role ? eq(users.role, role) : undefined,
      status ? eq(users.status, status) : undefined,
      q ? sql`(${ilike(users.name, q)} or ${ilike(users.email, q)})` : undefined,
    );

    const rows = await db
      .select({ ...adminUserColumns, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(where)
      .orderBy(order(USER_SORT[sortKey]), asc(users.id))
      .limit(limit)
      .offset(offset);

    let total = rows[0]?.total ?? 0;
    if (rows.length === 0 && offset > 0) total = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(users).where(where))[0]?.n ?? 0;
    return c.json({ data: rows.map(toAdminUser), meta: { page, pageSize, total } });
  });

  app.post("/users/invite", async (c) => {
    const me = c.get("me");
    const limited = await enforce(c, deps.limiter, limits.invite(me.id));
    if (limited) return limited;
    const parsed = await parseJson(c, inviteUserSchema);
    if (!parsed.ok) return parsed.response;
    const { orgId, name: givenName, role = "member" } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    if (!isUuid(orgId) || (scopeOrg(me) && scopeOrg(me) !== orgId)) return badRequest(c, "orgId does not match an organization");
    if (role === "owner" && me.role !== "owner") return forbidden(c, "Only an owner can invite another owner");
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId));
    if (!org) return badRequest(c, "orgId does not match an organization");

    try {
      const [row] = await db
        .insert(users)
        .values({ orgId, name: givenName || email.split("@")[0]!, email, role, status: "invited" })
        .returning({ id: users.id });
      await log(me, orgId, "invite_user", email);
      await sendPasswordLink(deps, { id: row!.id, name: givenName || email, email }, "invite");
      return c.json({ data: toAdminUser((await findUser(me, row!.id))!) }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) return fail(c, 409, "email_taken", "A user with this email already exists");
      throw error;
    }
  });

  // Registered before /users/:id so "bulk" is not read as an id.
  app.post("/users/bulk", async (c) => {
    const me = c.get("me");
    const parsed = bulkSchema.safeParse(await readBody(c));
    if (!parsed.success) return badRequest(c, "action (suspend | delete) and a non-empty ids array are required");
    const { action } = parsed.data;
    const ids = parsed.data.ids.filter(isUuid);
    if (ids.includes(me.id)) return fail(c, 409, "cannot_target_self", "You cannot act on your own account");

    const targets = await db
      .select({ id: users.id, email: users.email, orgId: users.orgId, role: users.role })
      .from(users)
      .where(and(inArray(users.id, ids), scopeOrg(me) ? eq(users.orgId, me.orgId) : undefined));
    const blocked = await guardOwner(c, me, targets);
    if (blocked) return blocked;

    await db.transaction(async (tx) => {
      if (targets.length === 0) return;
      const targetIds = targets.map((t) => t.id);
      if (action === "suspend") {
        await tx.update(users).set({ status: "suspended" }).where(inArray(users.id, targetIds));
        await tx.delete(sessions).where(inArray(sessions.userId, targetIds));
      } else {
        await tx.delete(users).where(inArray(users.id, targetIds));
      }
      await tx
        .insert(auditLog)
        .values(targets.map((t) => ({ orgId: t.orgId, actor: me.email, action: (action === "suspend" ? "suspend_user" : "delete_user") as AuditAction, target: t.email })));
    });
    return c.json({ data: { affected: targets.length } });
  });

  app.get("/users/:id", async (c) => {
    const user = await findUser(c.get("me"), c.req.param("id"));
    return user ? c.json({ data: toAdminUser(user) }) : notFound(c, "User");
  });

  app.patch("/users/:id", async (c) => {
    const me = c.get("me");
    const user = await findUser(me, c.req.param("id"));
    if (!user) return notFound(c, "User");

    const parsed = await parseJson(c, updateUserSchema);
    if (!parsed.ok) return parsed.response;
    const { name, email, role } = parsed.data;

    const roleChanges = role !== undefined && role !== user.role;
    if (roleChanges) {
      if (role === "owner" && me.role !== "owner") return forbidden(c, "Only an owner can make someone an owner");
      if (user.id === me.id) return fail(c, 409, "cannot_target_self", "You cannot change your own role");
      const blocked = await guardOwner(c, me, [user]);
      if (blocked) return blocked;
    } else if (user.role === "owner" && me.role !== "owner") {
      return forbidden(c, "Only an owner can change an owner");
    }

    const patch: Partial<typeof users.$inferInsert> = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email.toLowerCase();
    if (roleChanges) patch.role = role;
    try {
      if (Object.keys(patch).length > 0) await db.update(users).set(patch).where(eq(users.id, user.id));
    } catch (error) {
      if (isUniqueViolation(error)) return emailTaken(c);
      throw error;
    }

    const updated = (await findUser(me, user.id))!;
    if ((name !== undefined && name !== user.name) || (email !== undefined && email.toLowerCase() !== user.email.toLowerCase())) {
      await log(me, user.orgId, "update_user", updated.email);
    }
    if (roleChanges) await log(me, user.orgId, "update_role", `${updated.email} → ${role}`);
    return c.json({ data: toAdminUser(updated) });
  });

  const setStatus = (status: UserStatus, action: AuditAction) => async (c: Context<Env>) => {
    const me = c.get("me");
    const user = await findUser(me, c.req.param("id") ?? "");
    if (!user) return notFound(c, "User");
    if (user.id === me.id) return fail(c, 409, "cannot_target_self", "You cannot act on your own account");
    if (status === "suspended") {
      const blocked = await guardOwner(c, me, [user]);
      if (blocked) return blocked;
    } else if (user.role === "owner" && me.role !== "owner") {
      return forbidden(c, "Only an owner can change an owner");
    }

    // An invited user who has never signed in goes back to "invited", not "active", when reinstated.
    await db.transaction(async (tx) => {
      const next = status === "active" ? sql`case when ${users.passwordHash} is null then 'invited'::user_status else 'active'::user_status end` : status;
      await tx.update(users).set({ status: next }).where(eq(users.id, user.id));
      if (status === "suspended") await tx.delete(sessions).where(eq(sessions.userId, user.id));
    });
    await log(me, user.orgId, action, user.email);
    return c.json({ data: toAdminUser((await findUser(me, user.id))!) });
  };
  app.post("/users/:id/suspend", setStatus("suspended", "suspend_user"));
  app.post("/users/:id/reinstate", setStatus("active", "reinstate_user"));

  app.post("/users/:id/reset-password", async (c) => {
    const me = c.get("me");
    const user = await findUser(me, c.req.param("id"));
    if (!user) return notFound(c, "User");
    if (user.role === "owner" && me.role !== "owner") return forbidden(c, "Only an owner can change an owner");

    await sendPasswordLink(deps, user, user.status === "invited" ? "invite" : "reset");
    await log(me, user.orgId, "reset_password", user.email);
    return c.body(null, 204);
  });

  app.delete("/users/:id", async (c) => {
    const me = c.get("me");
    const user = await findUser(me, c.req.param("id"));
    if (!user) return notFound(c, "User");
    if (user.id === me.id) return fail(c, 409, "cannot_target_self", "You cannot act on your own account");
    const blocked = await guardOwner(c, me, [user]);
    if (blocked) return blocked;

    await db.delete(users).where(eq(users.id, user.id));
    await log(me, user.orgId, "delete_user", user.email);
    return c.body(null, 204);
  });

  // ---- Organizations ----

  const findOrg = async (me: Principal, id: string) => {
    if (!isUuid(id) || (scopeOrg(me) && scopeOrg(me) !== id)) return undefined;
    return (await db.select(orgColumns).from(organizations).where(eq(organizations.id, id)))[0];
  };

  app.get("/organizations", async (c) => {
    const me = c.get("me");
    const { limit, offset, page, pageSize } = pageParams(c);
    const plan = oneOf(c.req.query("plan"), schema.orgPlan.enumValues);
    const status = oneOf(c.req.query("status"), schema.orgStatus.enumValues);
    const q = c.req.query("q")?.trim();
    const order = c.req.query("direction") === "desc" ? desc : asc;

    const where = and(
      scopeOrg(me) ? eq(organizations.id, me.orgId) : undefined,
      plan ? eq(organizations.plan, plan) : undefined,
      status ? eq(organizations.status, status) : undefined,
      q ? ilike(organizations.name, q) : undefined,
    );
    const rows = await db
      .select({ ...orgColumns, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(organizations)
      .where(where)
      .orderBy(order(sql`lower(${organizations.name})`), asc(organizations.id))
      .limit(limit)
      .offset(offset);

    let total = rows[0]?.total ?? 0;
    if (rows.length === 0 && offset > 0) total = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(organizations).where(where))[0]?.n ?? 0;
    return c.json({ data: rows.map(toOrganization), meta: { page, pageSize, total } });
  });

  app.post("/organizations", async (c) => {
    const me = c.get("me");
    if (!me.isPlatform) return forbidden(c, "Only platform admins can create organizations");
    const parsed = await parseJson(c, createOrganizationSchema);
    if (!parsed.ok) return parsed.response;

    try {
      const [row] = await db
        .insert(organizations)
        .values({ name: parsed.data.name, plan: parsed.data.plan ?? "free", status: "trialing" })
        .returning({ id: organizations.id });
      await log(me, row!.id, "create_organization", parsed.data.name);
      return c.json({ data: toOrganization((await findOrg(me, row!.id))!) }, 201);
    } catch (error) {
      if (isUniqueViolation(error)) return fail(c, 409, "name_taken", "An organization with this name already exists");
      throw error;
    }
  });

  app.get("/organizations/:id", async (c) => {
    const org = await findOrg(c.get("me"), c.req.param("id"));
    return org ? c.json({ data: toOrganization(org) }) : notFound(c, "Organization");
  });

  app.patch("/organizations/:id", async (c) => {
    const me = c.get("me");
    const org = await findOrg(me, c.req.param("id"));
    if (!org) return notFound(c, "Organization");

    const parsed = await parseJson(c, updateOrganizationSchema);
    if (!parsed.ok) return parsed.response;
    const { name, plan } = parsed.data;
    // Plans are billing state: an organization's own admins must not be able to upgrade themselves.
    if (plan && plan !== org.plan && !me.isPlatform) return forbidden(c, "Only platform admins can change an organization's plan");

    try {
      await db.update(organizations).set({ name, ...(plan ? { plan } : {}) }).where(eq(organizations.id, org.id));
    } catch (error) {
      if (isUniqueViolation(error)) return fail(c, 409, "name_taken", "An organization with this name already exists");
      throw error;
    }
    await log(me, org.id, "update_organization", name);
    return c.json({ data: toOrganization((await findOrg(me, org.id))!) });
  });

  // ---- Audit log ----

  app.get("/audit-log", async (c) => {
    const me = c.get("me");
    const { limit, offset, page, pageSize } = pageParams(c);
    const action = oneOf(c.req.query("action"), schema.auditAction.enumValues);
    const q = c.req.query("q")?.trim();

    const where: SQL | undefined = and(
      scopeOrg(me) ? eq(auditLog.orgId, me.orgId) : undefined,
      action ? eq(auditLog.action, action) : undefined,
      q ? sql`(${ilike(auditLog.actor, q)} or ${ilike(auditLog.target, q)})` : undefined,
    );
    const rows = await db
      .select({
        id: auditLog.id,
        timestamp: auditLog.createdAt,
        actor: auditLog.actor,
        action: auditLog.action,
        target: auditLog.target,
        total: sql<number>`count(*) over()`.mapWith(Number),
      })
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit)
      .offset(offset);

    let total = rows[0]?.total ?? 0;
    if (rows.length === 0 && offset > 0) total = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(auditLog).where(where))[0]?.n ?? 0;
    const data: AuditLogEntry[] = rows.map((r) => ({ id: r.id, timestamp: iso(r.timestamp), actor: r.actor, action: r.action, target: r.target }));
    return c.json({ data, meta: { page, pageSize, total } });
  });

  return app;
}
