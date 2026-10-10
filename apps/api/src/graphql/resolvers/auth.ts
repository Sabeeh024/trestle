import {
  changePasswordSchema,
  contactSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  ssoSchema,
  updateProfileSchema,
} from "@trestle/api-client/schemas";
import type { SessionInfo } from "@trestle/api-client/types";
import { serializeSessionCookie } from "@trestle/auth/cookie";
import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";

import { audit, startSession, toUser, userColumns } from "../../context";
import { schema } from "../../db";
import { isUniqueViolation, isUuid } from "../../lib/http";
import { burnPasswordCheck, hashPassword, hashToken, verifyPassword } from "../../lib/password";
import { sendPasswordLink } from "../../lib/password-links";
import { clientIp, enforceOrThrow, limits } from "../../lib/rate-limit";
import type { GqlContext } from "../context";
import { ApiGraphQLError, emailTaken, notFound, validationFailed } from "../errors";
import { parseInput } from "../input";

const { users, organizations, sessions, passwordResets } = schema;

const byEmail = (email: string) => sql`lower(${users.email}) = ${email.toLowerCase()}`;

type Input = { input: unknown };

export const authQueries = {
  me: async (_: unknown, ctx: GqlContext) => {
    const me = await ctx.me();
    const [row] = await ctx.deps.db.select(userColumns).from(users).where(eq(users.id, me.id));
    return toUser(row!);
  },

  sessions: async (_: unknown, ctx: GqlContext): Promise<SessionInfo[]> => {
    const me = await ctx.me();
    const rows = await ctx.deps.db
      .select({ id: sessions.id, createdAt: sessions.createdAt, lastUsedAt: sessions.lastUsedAt, userAgent: sessions.userAgent })
      .from(sessions)
      .where(and(eq(sessions.userId, me.id), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.lastUsedAt), asc(sessions.id));
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt.toISOString(),
      userAgent: r.userAgent,
      current: r.id === me.sessionId,
    }));
  },
};

export const authMutations = {
  login: async ({ input }: Input, ctx: GqlContext) => {
    const { db, config, limiter } = ctx.deps;
    const { email, password } = parseInput(loginSchema, input);

    const ip = clientIp(ctx.http, config);
    const normalized = email.toLowerCase().slice(0, 200);
    const loginLimits = limits.login(ip, normalized);
    await enforceOrThrow(limiter, loginLimits);

    const [user] = await db
      .select({ ...userColumns, passwordHash: users.passwordHash })
      .from(users)
      .where(byEmail(email));

    const valid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : (await burnPasswordCheck(password), false);
    if (!user || !valid) {
      await audit(db, { orgId: user?.orgId ?? null, actor: "system", action: "login_failed", target: email.toLowerCase() });
      throw new ApiGraphQLError(401, "invalid_credentials", "Incorrect email or password");
    }
    if (user.status === "suspended") throw new ApiGraphQLError(403, "account_suspended", "This account is suspended");

    // A correct password wipes this client's own failure count for the account (the shared limits keep counting).
    if (limiter) await limiter.clear(loginLimits[0]![0]);
    await db.update(users).set({ lastActiveAt: new Date() }).where(eq(users.id, user.id));
    return startSession(ctx.http, ctx.deps, toUser({ ...user, lastActiveAt: new Date() }));
  },

  // Every new account starts in its own trial workspace and owns it.
  signup: async ({ input }: Input, ctx: GqlContext) => {
    const { db, config, limiter } = ctx.deps;
    await enforceOrThrow(limiter, limits.signup(clientIp(ctx.http, config)));
    const parsed = parseInput(signupSchema, input);
    const { name, password } = parsed;
    const email = parsed.email.toLowerCase();
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

      return await startSession(ctx.http, ctx.deps, toUser(user));
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  },

  // SSO needs an identity provider, which is not wired up. Until it is, the operation refuses rather than
  // trusting an email address; DEV_SSO=1 opts in to the old "any enterprise user" behavior for local work.
  sso: async ({ input }: Input, ctx: GqlContext) => {
    const { db, config } = ctx.deps;
    const { email } = parseInput(ssoSchema, input);

    const [row] = await db
      .select({ ...userColumns, plan: organizations.plan })
      .from(users)
      .innerJoin(organizations, eq(organizations.id, users.orgId))
      .where(byEmail(email));

    if (!row || row.plan !== "enterprise") throw new ApiGraphQLError(403, "sso_not_enabled", "Single sign-on isn't enabled for this organization");
    if (config.DEV_SSO !== "1") throw new ApiGraphQLError(501, "sso_not_configured", "Single sign-on has not been configured yet");
    if (row.status === "suspended") throw new ApiGraphQLError(403, "account_suspended", "This account is suspended");

    return startSession(ctx.http, ctx.deps, toUser(row));
  },

  // Always true, so the answer never reveals whether an address has an account.
  forgotPassword: async ({ input }: Input, ctx: GqlContext) => {
    const { db, config, limiter } = ctx.deps;
    const { email } = parseInput(forgotPasswordSchema, input);
    // Counted for unknown addresses too, so hitting the limit reveals nothing about which ones have accounts.
    await enforceOrThrow(limiter, limits.forgotPassword(clientIp(ctx.http, config), email.toLowerCase().slice(0, 200)));

    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, status: users.status }).from(users).where(byEmail(email));
    if (user && user.status !== "suspended") await sendPasswordLink(ctx.deps, user, "reset");
    return true;
  },

  // Completes a reset or an invitation: sets the password, activates an invited account, and signs out every device.
  resetPassword: async ({ input }: Input, ctx: GqlContext) => {
    const { db, config, limiter } = ctx.deps;
    await enforceOrThrow(limiter, limits.resetPassword(clientIp(ctx.http, config)));
    const parsed = parseInput(resetPasswordSchema, input);
    const tokenHash = hashToken(parsed.token);
    const passwordHash = await hashPassword(parsed.password);

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

    if (!done) throw new ApiGraphQLError(400, "invalid_token", "This link is invalid or has expired");
    return true;
  },

  updateProfile: async ({ input }: Input, ctx: GqlContext) => {
    const me = await ctx.me();
    const { name, email } = parseInput(updateProfileSchema, input);
    try {
      const [row] = await ctx.deps.db.update(users).set({ name, email: email.toLowerCase() }).where(eq(users.id, me.id)).returning(userColumns);
      return toUser(row!);
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  },

  logout: async (_: unknown, ctx: GqlContext) => {
    const me = await ctx.me();
    await ctx.deps.db.delete(sessions).where(eq(sessions.id, me.sessionId));
    clearCookie(ctx);
    return true;
  },

  // Needs the current password, so a stolen session alone cannot set a new one, and signs out every other device.
  changePassword: async ({ input }: Input, ctx: GqlContext) => {
    const { db, limiter } = ctx.deps;
    const me = await ctx.me();
    await enforceOrThrow(limiter, limits.changePassword(me.id));
    const parsed = parseInput(changePasswordSchema, input);

    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, me.id));
    if (!row?.hash || !(await verifyPassword(parsed.currentPassword, row.hash))) {
      throw validationFailed({ currentPassword: "passwordIncorrect" });
    }

    const passwordHash = await hashPassword(parsed.newPassword);
    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash }).where(eq(users.id, me.id));
      await tx.delete(sessions).where(and(eq(sessions.userId, me.id), ne(sessions.id, me.sessionId)));
      await tx.delete(passwordResets).where(eq(passwordResets.userId, me.id));
    });
    return true;
  },

  revokeSession: async ({ id }: { id: string }, ctx: GqlContext) => {
    const me = await ctx.me();
    const [gone] = isUuid(id)
      ? await ctx.deps.db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, me.id))).returning({ id: sessions.id })
      : [];
    if (!gone) throw notFound("Session");
    if (gone.id === me.sessionId) clearCookie(ctx);
    return true;
  },

  revokeOtherSessions: async (_: unknown, ctx: GqlContext) => {
    const me = await ctx.me();
    await ctx.deps.db.delete(sessions).where(and(eq(sessions.userId, me.id), ne(sessions.id, me.sessionId)));
    return true;
  },

  // The marketing site's contact form: public, stored for the team to read.
  sendContactMessage: async ({ input }: Input, ctx: GqlContext) => {
    const { db, config, limiter } = ctx.deps;
    await enforceOrThrow(limiter, limits.contact(clientIp(ctx.http, config)));
    const { name, email, company, message } = parseInput(contactSchema, input);
    await db.insert(schema.contactMessages).values({ name, email: email.toLowerCase(), company: company ?? "", message });
    return true;
  },
};

function clearCookie(ctx: GqlContext) {
  ctx.http.header("Set-Cookie", serializeSessionCookie(ctx.deps.cookie.name, "", ctx.deps.cookie.options));
}
