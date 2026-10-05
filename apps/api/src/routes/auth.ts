import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  ssoSchema,
  updateProfileSchema,
} from "@trestle/api-client/schemas";
import { and, eq, gt, sql } from "drizzle-orm";
import { Hono } from "hono";

import { audit, createSession, requireAuth, toUser, userColumns, type Deps, type Env } from "../context";
import { schema } from "../db";
import { emailTaken, fail, isUniqueViolation, parseJson } from "../lib/http";
import { clientIp, enforce, limits } from "../lib/rate-limit";
import { burnPasswordCheck, hashPassword, hashToken, verifyPassword } from "../lib/password";
import { sendPasswordLink } from "../lib/password-links";

const { users, organizations, sessions, passwordResets } = schema;

const byEmail = (email: string) => sql`lower(${users.email}) = ${email.toLowerCase()}`;

export function authRoutes(deps: Deps) {
  const { db, config, limiter } = deps;
  const app = new Hono<Env>();

  app.post("/login", async (c) => {
    const parsed = await parseJson(c, loginSchema);
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    const ip = clientIp(c, config.TRUST_PROXY);
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
    const token = await createSession(db, user.id, config.SESSION_TTL_DAYS);
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));
    return c.json({ data: { token, user: toUser({ ...user, lastActiveAt: new Date() }) } });
  });

  // Every new account starts in its own trial workspace and owns it.
  app.post("/signup", async (c) => {
    const limited = await enforce(c, limiter, limits.signup(clientIp(c, config.TRUST_PROXY)));
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

      const token = await createSession(db, user.id, config.SESSION_TTL_DAYS);
      return c.json({ data: { token, user: toUser(user) } }, 201);
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

    const token = await createSession(db, row.id, config.SESSION_TTL_DAYS);
    return c.json({ data: { token, user: toUser(row) } });
  });

  // Always answers 204, so the response never reveals whether an address has an account.
  app.post("/forgot-password", async (c) => {
    const parsed = await parseJson(c, forgotPasswordSchema);
    if (!parsed.ok) return parsed.response;
    // Counted for unknown addresses too, so hitting the limit reveals nothing about which ones have accounts.
    const limited = await enforce(c, limiter, limits.forgotPassword(clientIp(c, config.TRUST_PROXY), parsed.data.email.toLowerCase().slice(0, 200)));
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
    const limited = await enforce(c, limiter, limits.resetPassword(clientIp(c, config.TRUST_PROXY)));
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

  authed.post("/logout", async (c) => {
    const token = c.req.header("authorization")!.slice(7).trim();
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
    return c.body(null, 204);
  });

  app.route("/", authed);
  return app;
}
