import { createOrganizationSchema, inviteUserSchema, updateOrganizationSchema, updateUserSchema } from "@trestle/api-client/schemas";
import type { AuditAction, AuditLogEntry, Organization, UserRole, UserStatus } from "@trestle/api-client/types";
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { isAdmin, toUser, userColumns, type Principal } from "../../context";
import { schema } from "../../db";
import { ilike, isUniqueViolation, isUuid, iso, pageFrom } from "../../lib/http";
import { sendPasswordLink } from "../../lib/password-links";
import { enforceOrThrow, limits } from "../../lib/rate-limit";
import type { GqlContext } from "../context";
import { badRequest, conflict, emailTaken, forbidden, notFound } from "../errors";
import { parseInput } from "../input";

const { users, organizations, auditLog, sessions } = schema;

type Input = { input: unknown };
type PageArgs = { page?: number | null; pageSize?: number | null };

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

/** The caller, once they are known to be an owner or admin. */
async function admin(ctx: GqlContext) {
  const me = await ctx.me();
  if (!isAdmin(me)) throw forbidden("Admin access required");
  return me;
}

const findUser = async (ctx: GqlContext, me: Principal, id: string) => {
  if (!isUuid(id)) return undefined;
  const [row] = await ctx.deps.db
    .select(adminUserColumns)
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(and(eq(users.id, id), scopeOrg(me) ? eq(users.orgId, me.orgId) : undefined));
  return row;
};

const mustFindUser = async (ctx: GqlContext, me: Principal, id: string) => {
  const user = await findUser(ctx, me, id);
  if (!user) throw notFound("User");
  return user;
};

const log = (ctx: GqlContext, me: Principal, orgId: string, action: AuditAction, target: string) =>
  ctx.deps.db.insert(auditLog).values({ orgId, actor: me.email, action, target });

/** Owners can only be changed by owners, and an organization is never left without one. */
async function guardOwner(ctx: GqlContext, me: Principal, targets: { id: string; orgId: string; role: UserRole }[], leaving = targets) {
  const owners = targets.filter((t) => t.role === "owner");
  if (owners.length === 0) return;
  if (me.role !== "owner") throw forbidden("Only an owner can change an owner");

  const leavingIds = new Set(leaving.filter((t) => t.role === "owner").map((t) => t.id));
  for (const orgId of new Set(owners.map((o) => o.orgId))) {
    const rows = await ctx.deps.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, "owner"), ne(users.status, "suspended")));
    if (rows.every((r) => leavingIds.has(r.id))) throw conflict("last_owner", "An organization needs at least one active owner");
  }
}

const notSelf = (me: Principal, id: string, message = "You cannot act on your own account") => {
  if (id === me.id) throw conflict("cannot_target_self", message);
};

const findOrg = async (ctx: GqlContext, me: Principal, id: string) => {
  if (!isUuid(id) || (scopeOrg(me) && scopeOrg(me) !== id)) return undefined;
  return (await ctx.deps.db.select(orgColumns).from(organizations).where(eq(organizations.id, id)))[0];
};

const nameTaken = () => conflict("name_taken", "An organization with this name already exists");

export const adminQueries = {
  adminUsers: async (
    args: PageArgs & { q?: string | null; role?: UserRole | null; status?: UserStatus | null; orgId?: string | null; sort?: keyof typeof USER_SORT | null; direction?: "asc" | "desc" | null },
    ctx: GqlContext,
  ) => {
    const me = await admin(ctx);
    const { limit, offset, page, pageSize } = pageFrom(args);
    const q = args.q?.trim();
    const order = args.direction === "desc" ? desc : asc;

    const scope = scopeOrg(me);
    const where = and(
      scope ? eq(users.orgId, scope) : args.orgId ? (isUuid(args.orgId) ? eq(users.orgId, args.orgId) : sql`false`) : undefined,
      args.role ? eq(users.role, args.role) : undefined,
      args.status ? eq(users.status, args.status) : undefined,
      q ? sql`(${ilike(users.name, q)} or ${ilike(users.email, q)})` : undefined,
    );

    const rows = await ctx.deps.db
      .select({ ...adminUserColumns, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(where)
      .orderBy(order(USER_SORT[args.sort ?? "name"]), asc(users.id))
      .limit(limit)
      .offset(offset);

    let total = rows[0]?.total ?? 0;
    if (rows.length === 0 && offset > 0) total = (await ctx.deps.db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(users).where(where))[0]?.n ?? 0;
    return { data: rows.map(toUser), meta: { page, pageSize, total } };
  },

  adminUser: async ({ id }: { id: string }, ctx: GqlContext) => {
    const me = await admin(ctx);
    return toUser(await mustFindUser(ctx, me, id));
  },

  adminOrganizations: async (
    args: PageArgs & { q?: string | null; plan?: Organization["plan"] | null; status?: Organization["status"] | null; direction?: "asc" | "desc" | null },
    ctx: GqlContext,
  ) => {
    const me = await admin(ctx);
    const { limit, offset, page, pageSize } = pageFrom(args);
    const q = args.q?.trim();
    const order = args.direction === "desc" ? desc : asc;

    const where = and(
      scopeOrg(me) ? eq(organizations.id, me.orgId) : undefined,
      args.plan ? eq(organizations.plan, args.plan) : undefined,
      args.status ? eq(organizations.status, args.status) : undefined,
      q ? ilike(organizations.name, q) : undefined,
    );
    const rows = await ctx.deps.db
      .select({ ...orgColumns, total: sql<number>`count(*) over()`.mapWith(Number) })
      .from(organizations)
      .where(where)
      .orderBy(order(sql`lower(${organizations.name})`), asc(organizations.id))
      .limit(limit)
      .offset(offset);

    let total = rows[0]?.total ?? 0;
    if (rows.length === 0 && offset > 0) total = (await ctx.deps.db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(organizations).where(where))[0]?.n ?? 0;
    return { data: rows.map(toOrganization), meta: { page, pageSize, total } };
  },

  adminOrganization: async ({ id }: { id: string }, ctx: GqlContext) => {
    const me = await admin(ctx);
    const org = await findOrg(ctx, me, id);
    if (!org) throw notFound("Organization");
    return toOrganization(org);
  },

  auditLog: async (args: PageArgs & { q?: string | null; action?: AuditAction | null }, ctx: GqlContext) => {
    const me = await admin(ctx);
    const { limit, offset, page, pageSize } = pageFrom(args);
    const q = args.q?.trim();

    const where: SQL | undefined = and(
      scopeOrg(me) ? eq(auditLog.orgId, me.orgId) : undefined,
      args.action ? eq(auditLog.action, args.action) : undefined,
      q ? sql`(${ilike(auditLog.actor, q)} or ${ilike(auditLog.target, q)})` : undefined,
    );
    const rows = await ctx.deps.db
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
    if (rows.length === 0 && offset > 0) total = (await ctx.deps.db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(auditLog).where(where))[0]?.n ?? 0;
    const data: AuditLogEntry[] = rows.map((r) => ({ id: r.id, timestamp: iso(r.timestamp), actor: r.actor, action: r.action, target: r.target }));
    return { data, meta: { page, pageSize, total } };
  },
};

export const adminMutations = {
  inviteUser: async ({ input }: Input, ctx: GqlContext) => {
    const { db, limiter } = ctx.deps;
    const me = await admin(ctx);
    await enforceOrThrow(limiter, limits.invite(me.id));
    const parsed = parseInput(inviteUserSchema, input);
    const { orgId, name: givenName, role = "member" } = parsed;
    const email = parsed.email.toLowerCase();

    if (!isUuid(orgId) || (scopeOrg(me) && scopeOrg(me) !== orgId)) throw badRequest("orgId does not match an organization");
    if (role === "owner" && me.role !== "owner") throw forbidden("Only an owner can invite another owner");
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId));
    if (!org) throw badRequest("orgId does not match an organization");

    try {
      const [row] = await db
        .insert(users)
        .values({ orgId, name: givenName || email.split("@")[0]!, email, role, status: "invited" })
        .returning({ id: users.id });
      await log(ctx, me, orgId, "invite_user", email);
      await sendPasswordLink(ctx.deps, { id: row!.id, name: givenName || email, email }, "invite");
      return toUser((await findUser(ctx, me, row!.id))!);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("email_taken", "A user with this email already exists");
      throw error;
    }
  },

  bulkUserAction: async (args: { action: "suspend" | "delete"; ids: string[] }, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await admin(ctx);
    const parsed = bulkSchema.safeParse(args);
    if (!parsed.success) throw badRequest("action (suspend | delete) and 1 to 200 ids are required");
    const { action } = parsed.data;
    const ids = parsed.data.ids.filter(isUuid);
    if (ids.includes(me.id)) throw conflict("cannot_target_self", "You cannot act on your own account");

    const targets = await db
      .select({ id: users.id, email: users.email, orgId: users.orgId, role: users.role })
      .from(users)
      .where(and(inArray(users.id, ids), scopeOrg(me) ? eq(users.orgId, me.orgId) : undefined));
    await guardOwner(ctx, me, targets);

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
    return { affected: targets.length };
  },

  updateUser: async ({ id, input }: { id: string } & Input, ctx: GqlContext) => {
    const { db } = ctx.deps;
    const me = await admin(ctx);
    const user = await mustFindUser(ctx, me, id);

    const { name, email, role } = parseInput(updateUserSchema, input);

    const roleChanges = role !== undefined && role !== user.role;
    if (roleChanges) {
      if (role === "owner" && me.role !== "owner") throw forbidden("Only an owner can make someone an owner");
      notSelf(me, user.id, "You cannot change your own role");
      await guardOwner(ctx, me, [user]);
    } else if (user.role === "owner" && me.role !== "owner") {
      throw forbidden("Only an owner can change an owner");
    }

    const patch: Partial<typeof users.$inferInsert> = {};
    if (name !== undefined) patch.name = name;
    if (email !== undefined) patch.email = email.toLowerCase();
    if (roleChanges) patch.role = role;
    try {
      if (Object.keys(patch).length > 0) await db.update(users).set(patch).where(eq(users.id, user.id));
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }

    const updated = (await findUser(ctx, me, user.id))!;
    if ((name !== undefined && name !== user.name) || (email !== undefined && email.toLowerCase() !== user.email.toLowerCase())) {
      await log(ctx, me, user.orgId, "update_user", updated.email);
    }
    if (roleChanges) await log(ctx, me, user.orgId, "update_role", `${updated.email} → ${role}`);
    return toUser(updated);
  },

  suspendUser: ({ id }: { id: string }, ctx: GqlContext) => setStatus(ctx, id, "suspended", "suspend_user"),
  reinstateUser: ({ id }: { id: string }, ctx: GqlContext) => setStatus(ctx, id, "active", "reinstate_user"),

  resetUserPassword: async ({ id }: { id: string }, ctx: GqlContext) => {
    const me = await admin(ctx);
    const user = await mustFindUser(ctx, me, id);
    if (user.role === "owner" && me.role !== "owner") throw forbidden("Only an owner can change an owner");

    await sendPasswordLink(ctx.deps, user, user.status === "invited" ? "invite" : "reset");
    await log(ctx, me, user.orgId, "reset_password", user.email);
    return true;
  },

  deleteUser: async ({ id }: { id: string }, ctx: GqlContext) => {
    const me = await admin(ctx);
    const user = await mustFindUser(ctx, me, id);
    notSelf(me, user.id);
    await guardOwner(ctx, me, [user]);

    await ctx.deps.db.delete(users).where(eq(users.id, user.id));
    await log(ctx, me, user.orgId, "delete_user", user.email);
    return true;
  },

  createOrganization: async ({ input }: Input, ctx: GqlContext) => {
    const me = await admin(ctx);
    if (!me.isPlatform) throw forbidden("Only platform admins can create organizations");
    const parsed = parseInput(createOrganizationSchema, input);

    try {
      const [row] = await ctx.deps.db
        .insert(organizations)
        .values({ name: parsed.name, plan: parsed.plan ?? "free", status: "trialing" })
        .returning({ id: organizations.id });
      await log(ctx, me, row!.id, "create_organization", parsed.name);
      return toOrganization((await findOrg(ctx, me, row!.id))!);
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  },

  updateOrganization: async ({ id, input }: { id: string } & Input, ctx: GqlContext) => {
    const me = await admin(ctx);
    const org = await findOrg(ctx, me, id);
    if (!org) throw notFound("Organization");

    const { name, plan } = parseInput(updateOrganizationSchema, input);
    // Plans are billing state: an organization's own admins must not be able to upgrade themselves.
    if (plan && plan !== org.plan && !me.isPlatform) throw forbidden("Only platform admins can change an organization's plan");

    try {
      await ctx.deps.db.update(organizations).set({ name, ...(plan ? { plan } : {}) }).where(eq(organizations.id, org.id));
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
    await log(ctx, me, org.id, "update_organization", name);
    return toOrganization((await findOrg(ctx, me, org.id))!);
  },
};

async function setStatus(ctx: GqlContext, id: string, status: UserStatus, action: AuditAction) {
  const me = await admin(ctx);
  const user = await mustFindUser(ctx, me, id);
  notSelf(me, user.id);
  if (status === "suspended") {
    await guardOwner(ctx, me, [user]);
  } else if (user.role === "owner" && me.role !== "owner") {
    throw forbidden("Only an owner can change an owner");
  }

  // An invited user who has never signed in goes back to "invited", not "active", when reinstated.
  await ctx.deps.db.transaction(async (tx) => {
    const next = status === "active" ? sql`case when ${users.passwordHash} is null then 'invited'::user_status else 'active'::user_status end` : status;
    await tx.update(users).set({ status: next }).where(eq(users.id, user.id));
    if (status === "suspended") await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  await log(ctx, me, user.orgId, action, user.email);
  return toUser((await findUser(ctx, me, user.id))!);
}
