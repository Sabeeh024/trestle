import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  ssoSchema,
  updateProfileSchema,
} from "@trestle/api-client/schemas";
import type { SessionInfo } from "@trestle/api-client/types";
import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";

import { serializeSessionCookie } from "@trestle/auth/cookie";

import { audit, requireAuth, startSession, toUser, userColumns, type Deps, type Env } from "../context";
import { schema } from "../db";
import { emailTaken, fail, isUniqueViolation, notFound, parseJson } from "../lib/http";
import { clientIp, enforce, limits } from "../lib/rate-limit";
import { burnPasswordCheck, hashPassword, hashToken, verifyPassword } from "../lib/password";
import { sendPasswordLink } from "../lib/password-links";
import { isUuid } from "./tasks";

const { users, organizations, sessions, passwordResets } = schema;

const byEmail = (email: string) => sql`lower(${users.email}) = ${email.toLowerCase()}`;

export function authRoutes(deps: Deps) {
  const { db, config, limiter } = deps;
  const app = new Hono<Env>();

  app.post("/login", async (c) => {
    const parsed = await parseJson(c, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    const ip = clientIp(c, config);
    const normalized = email.toLowerCase().slice(0, 200);
    const loginLimits = limits.login(ip, normalized);
    const limited = await enforce(c, limiter, loginLimits);
    if (limited) return limited;

    const [user] = await db
      .select({ ...userColumns, passwordHash: users.passwordHash })
      .from(users)
      .where(byEmail(email));

    const valid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
    if (!user || !valid) {
      await audit(db, { orgId: user?.orgId ?? null, actor: "system", action: "login_failed", target: email.toLowerCase() });
      return fail(c, 401, "invalid_credentials", "Incorrect email or password");
    }
    if (user.status === "suspended") return fail(c, 403, "account_suspended", "This account is suspended");

    // A correct password wipes this client's own failure count for the account (the shared limits keep counting).
    if (limiter) await limiter.clear(loginLimits[0]![0]);
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));
    return startSession(c, deps, toUser({ ...user, lastActiveAt: new Date() }));
  });

  // Every new account starts in its own trial workspace and owns it.
  app.post("/signup", async (c) => {
    const limited = await enforce(c, limiter, limits.signup(clientIp(c, config)));
    if (limited) return limited;
    const parsed = await parseJson(c, signupSchema);
    if (!parsed.ok) return parsed.response;
    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const passwordHash = await hashPassword(password);

    try {
      const user = await db.transaction(async (tx) => {
        const [org] = await tx
          .insert(organizations)
          .values({ name: `${name}'s workspace`, plan: "free", status: "trialing" })
          .onConflictDoNothing()
          .returning({ id: organizations.id });
        // The workspace name is unique; a second "Sam" gets a numbered one.
        const orgId =
          org?.id ??
          (
            await tx
              .insert(organizations)
              .values({ name: `${name}'s workspace (${Date.now().toString(36)})`, plan: "free", status: "trialing" })
              .returning({ id: organizations.id })
          )[0]!.id;

        const [row] = await tx
          .insert(users)
          .values({ orgId, name, email, passwordHash, role: "owner", status: "active", lastActiveAt: new Date() })
          .returning(userColumns);
        await tx.insert(schema.auditLog).values({ orgId, actor: email, action: "signup", target: email });
        return row!;
      });

      return await startSession(c, deps, toUser(user), 201);
    } catch (error) {
      if (isUniqueViolation(error)) return emailTaken(c);
      throw error;
    }
  });

  // SSO needs an identity provider, which is not wired up. Until it is, the endpoint refuses rather than
  // trusting an email address; DEV_SSO=1 opts in to the old "any enterprise user" behavior for local work.
  app.post("/sso", async (c) => {
    const parsed = await parseJson(c, ssoSchema);
    if (!parsed.ok) return parsed.response;

    const [row] = await db
      .select({ ...userColumns, plan: organizations.plan })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(byEmail(parsed.data.email));

    if (!row || row.plan !== "enterprise") return fail(c, 403, "sso_not_enabled", "Single sign-on isn't enabled for this organization");
    if (config.DEV_SSO !== "1") return fail(c, 501, "sso_not_configured", "Single sign-on has not been configured yet");
    if (row.status === "suspended") return fail(c, 403, "account_suspended", "This account is suspended");

    return startSession(c, deps, toUser(row));
  });

  // Always answers 204, so the response never reveals whether an address has an account.
  app.post("/forgot-password", async (c) => {
    const parsed = await parseJson(c, forgotPasswordSchema);
    if (!parsed.ok) return parsed.response;
    // Counted for unknown addresses too, so hitting the limit reveals nothing about which ones have accounts.
    const limited = await enforce(c, limiter, limits.forgotPassword(clientIp(c, config), parsed.data.email.toLowerCase().slice(0, 200)));
    if (limited) return limited;

    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email, status: users.status })
      .from(users)
      .where(byEmail(parsed.data.email));
    if (user && user.status !== "suspended") await sendPasswordLink(deps, user, "reset");
    return c.body(null, 204);
  });

  // Completes a reset or an invitation: sets the password, activates an invited account, and signs out every device.
  app.post("/reset-password", async (c) => {
    const limited = await enforce(c, limiter, limits.resetPassword(clientIp(c, config)));
    if (limited) return limited;
    const parsed = await parseJson(c, resetPasswordSchema);
    if (!parsed.ok) return parsed.response;
    const tokenHash = hashToken(parsed.data.token);
    const passwordHash = await hashPassword(parsed.data.password);

    const done = await db.transaction(async (tx) => {
      // Deleting first makes the link single-use even if two requests race.
      const [link] = await tx
        .delete(passwordResets)
        .where(and(eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, new Date())))
        .returning({ userId: passwordResets.userId });
      if (!link) return false;

      await tx
        .update(users)
        .set({ passwordHash, status: sql`case when ${users.status} = 'invited' then 'active'::user_status else ${users.status} end` })
        .where(eq(users.id, link.userId));
      await tx.delete(sessions).where(eq(sessions.userId, link.userId));
      await tx.delete(passwordResets).where(eq(passwordResets.userId, link.userId));
      return true;
    });

    if (!done) return fail(c, 400, "invalid_token", "This link is invalid or has expired");
    return c.body(null, 204);
  });

  const authed = new Hono<Env>();
  authed.use("*", requireAuth(deps));

  authed.get("/me", async (c) => {
    const me = c.get("me");
    const [row] = await db.select(userColumns).from(users).where(eq(users.id, me.id));
    return c.json({ data: toUser(row!) });
  });

  authed.patch("/me", async (c) => {
    const me = c.get("me");
    const parsed = await parseJson(c, updateProfileSchema);
    if (!parsed.ok) return parsed.response;

    try {
      const [row] = await db
        .update(users)
        .set({ name: parsed.data.name, email: parsed.data.email.toLowerCase() })
        .where(eq(users.id, me.id))
        .returning(userColumns);
      return c.json({ data: toUser(row!) });
    } catch (error) {
      if (isUniqueViolation(error)) return emailTaken(c);
      throw error;
    }
  });

  const clearCookie = (c: Context) => c.header("Set-Cookie", serializeSessionCookie(deps.cookie.name, "", deps.cookie.options));

  authed.post("/logout", async (c) => {
    await db.delete(sessions).where(eq(sessions.id, c.get("me").sessionId));
    clearCookie(c);
    return c.body(null, 204);
  });

  // Needs the current password, so a stolen session alone cannot set a new one, and signs out every other device.
  authed.post("/change-password", async (c) => {
    const me = c.get("me");
    const limited = await enforce(c, limiter, limits.changePassword(me.id));
    if (limited) return limited;
    const parsed = await parseJson(c, changePasswordSchema);
    if (!parsed.ok) return parsed.response;

    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id));
    if (!row?.hash || !(await verifyPassword(parsed.data.currentPassword, row.hash))) {
      return fail(c, 422, "validation_failed", "Some fields are invalid", { currentPassword: "passwordIncorrect" });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, me.id));
      await tx.delete(sessions).where(and(eq(sessions.userId, me.id), ne(sessions.id, me.sessionId)));
      await tx.delete(passwordResets).where(eq(passwordResets.userId, me.id));
    });
    return c.body(null, 204);
  });

  authed.get("/sessions", async (c) => {
    const me = c.get("me");
    const rows = await db
      .select({ id: sessions.id, createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt, userAgent: sessions.userAgent })
      .from(sessions)
      .where(and(eq(sessions.userId, me.id), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastUsedAt), asc(sessions.id));
    const data: SessionInfo[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt.toISOString(),
      userAgent: r.userAgent,
      current: r.id === me.sessionId,
    }));
    return c.json({ data });
  });

  // Registered before /sessions/:id so "sessions" with no id means "every other one".
  authed.delete("/sessions", async (c) => {
    const me = c.get("me");
    await db.delete(sessions).where(and(eq(sessions.userId, me.id), ne(sessions.id, me.sessionId)));
    return c.body(null, 204);
  });

  authed.delete("/sessions/:id", async (c) => {
    const me = c.get("me");
    const id = c.req.param("id");
    const [gone] = isUuid(id)
      ? await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, me.id))).returning({ id: sessions.id })
      : [];
    if (!gone) return notFound(c, "Session");
    if (gone.id === me.sessionId) clearCookie(c);
    return c.body(null, 204);
  });

  app.route("/", authed);
  return app;
}
