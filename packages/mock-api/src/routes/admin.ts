import { Hono, type Context } from "hono";

import { ME_ID } from "../data/seed";
import { initials, type Db } from "../db";
import { changeRoleSchema, createOrganizationSchema, inviteUserSchema } from "@trestle/api-client/schemas";
import { badRequest, fail, matches, notFound, oneOf, paginate, parseBody, readBody, sortBy } from "../http";
import type { AdminUser, AuditAction, OrgPlan, OrgStatus, User, UserRole, UserStatus } from "@trestle/api-client/types";

const ROLES = ["owner", "admin", "member", "viewer"] as const satisfies readonly UserRole[];
const USER_STATUSES = ["active", "invited", "suspended"] as const satisfies readonly UserStatus[];
const PLANS = ["free", "pro", "enterprise"] as const satisfies readonly OrgPlan[];
const ORG_STATUSES = ["active", "trialing", "pastDue"] as const satisfies readonly OrgStatus[];
const AUDIT_ACTIONS = [
  "suspend_user",
  "reinstate_user",
  "delete_user",
  "invite_user",
  "update_role",
  "reset_password",
  "create_project",
  "delete_project",
  "create_organization",
  "billing_charge",
  "login_failed",
] as const satisfies readonly AuditAction[];
const USER_SORT_KEYS = ["name", "email", "role", "status", "joinedAt"] as const;

export function adminRoutes(db: Db) {
  const app = new Hono();

  const withOrg = (user: User): AdminUser => ({ ...user, orgName: db.org(user.orgId)?.name ?? "—" });

  // ---- Users ----

  app.get("/users", (c) => {
    const q = c.req.query("q");
    const role = oneOf(c.req.query("role"), ROLES);
    const status = oneOf(c.req.query("status"), USER_STATUSES);
    const orgId = c.req.query("orgId");
    const sortKey = oneOf(c.req.query("sort"), USER_SORT_KEYS) ?? "name";

    const filtered = db.state.users.filter(
      (u) => (!role || u.role === role) && (!status || u.status === status) && (!orgId || u.orgId === orgId) && matches(q, u.name, u.email),
    );
    return c.json(paginate(c, sortBy(filtered, sortKey, c.req.query("direction")).map(withOrg)));
  });

  app.post("/users/invite", async (c) => {
    const parsed = parseBody(c, inviteUserSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    const { orgId, name: givenName, role } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    if (!db.org(orgId)) return badRequest(c, "orgId does not match an organization");
    if (db.state.users.some((u) => u.email.toLowerCase() === email)) return fail(c, 409, "email_taken", "A user with this email already exists");

    const name = givenName || email.split("@")[0]!;
    const user: User = {
      id: `usr_${String(db.state.users.length + 1).padStart(6, "0")}`,
      name,
      initials: initials(name),
      email,
      orgId,
      role: role ?? "member",
      status: "invited",
      joinedAt: new Date().toISOString(),
      lastActiveAt: null,
    };
    db.state.users.push(user);
    db.log("invite_user", email);
    return c.json({ data: withOrg(user) }, 201);
  });

  // Registered before /users/:id so "bulk" is not read as an id.
  app.post("/users/bulk", async (c) => {
    const body = await readBody(c);
    const action = oneOf(body.action, ["suspend", "delete"] as const);
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string") : [];
    if (!action || ids.length === 0) return badRequest(c, "action (suspend | delete) and a non-empty ids array are required");
    if (ids.includes(ME_ID)) return fail(c, 409, "cannot_target_self", "You cannot act on your own account");

    const targets = db.state.users.filter((u) => ids.includes(u.id));
    for (const user of targets) {
      if (action === "suspend") user.status = "suspended";
      db.log(action === "suspend" ? "suspend_user" : "delete_user", user.email);
    }
    if (action === "delete") db.state.users = db.state.users.filter((u) => !ids.includes(u.id));
    return c.json({ data: { affected: targets.length } });
  });

  app.get("/users/:id", (c) => {
    const user = db.user(c.req.param("id"));
    return user ? c.json({ data: withOrg(user) }) : notFound(c, "User");
  });

  app.patch("/users/:id", async (c) => {
    const user = db.user(c.req.param("id"));
    if (!user) return notFound(c, "User");

    const parsed = parseBody(c, changeRoleSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    const { role } = parsed.data;
    user.role = role;
    db.log("update_role", `${user.email} → ${role}`);
    return c.json({ data: withOrg(user) });
  });

  const setStatus = (status: UserStatus, action: AuditAction) => (c: Context) => {
    const user = db.user(c.req.param("id") ?? "");
    if (!user) return notFound(c, "User");
    if (user.id === ME_ID) return fail(c, 409, "cannot_target_self", "You cannot act on your own account");

    user.status = status;
    db.log(action, user.email);
    return c.json({ data: withOrg(user) });
  };
  app.post("/users/:id/suspend", setStatus("suspended", "suspend_user"));
  app.post("/users/:id/reinstate", setStatus("active", "reinstate_user"));

  app.post("/users/:id/reset-password", (c) => {
    const user = db.user(c.req.param("id"));
    if (!user) return notFound(c, "User");
    db.log("reset_password", user.email);
    return c.body(null, 204);
  });

  app.delete("/users/:id", (c) => {
    const user = db.user(c.req.param("id"));
    if (!user) return notFound(c, "User");
    if (user.id === ME_ID) return fail(c, 409, "cannot_target_self", "You cannot act on your own account");

    db.state.users = db.state.users.filter((u) => u.id !== user.id);
    db.log("delete_user", user.email);
    return c.body(null, 204);
  });

  // ---- Organizations ----

  app.get("/organizations", (c) => {
    const plan = oneOf(c.req.query("plan"), PLANS);
    const status = oneOf(c.req.query("status"), ORG_STATUSES);
    const items = db.state.orgs
      .filter((o) => (!plan || o.plan === plan) && (!status || o.status === status) && matches(c.req.query("q"), o.name))
      .map((o) => db.org(o.id)!);
    return c.json(paginate(c, sortBy(items, "name", c.req.query("direction"))));
  });

  app.post("/organizations", async (c) => {
    const parsed = parseBody(c, createOrganizationSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    const { name, plan } = parsed.data;

    const record = {
      id: `org_${name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
      name,
      plan: plan ?? "free",
      status: "trialing" as const,
      createdAt: new Date().toISOString(),
    };
    if (db.state.orgs.some((o) => o.id === record.id)) return fail(c, 409, "name_taken", "An organization with this name already exists");

    db.state.orgs.push(record);
    db.log("create_organization", name);
    return c.json({ data: db.org(record.id) }, 201);
  });

  app.get("/organizations/:id", (c) => {
    const org = db.org(c.req.param("id"));
    return org ? c.json({ data: org }) : notFound(c, "Organization");
  });

  // ---- Audit log ----

  app.get("/audit-log", (c) => {
    const action = oneOf(c.req.query("action"), AUDIT_ACTIONS);
    const items = db.state.audit
      .filter((e) => (!action || e.action === action) && matches(c.req.query("q"), e.actor, e.target))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return c.json(paginate(c, items));
  });

  return app;
}
