import { Hono, type Context } from "hono";

import type { Db } from "../db";
import { forgotPasswordSchema, loginSchema, signupSchema, ssoSchema, updateProfileSchema } from "@trestle/api-client/schemas";
import { initials } from "../db";
import { fail, parseBody, readBody } from "../http";
import type { User } from "@trestle/api-client/types";

const TOKEN_PREFIX = "mock-token-";

export function userFromRequest(c: Context, db: Db): User | undefined {
  const header = c.req.header("authorization");
  if (!header?.startsWith(`Bearer ${TOKEN_PREFIX}`)) return undefined;
  return db.user(header.slice(`Bearer ${TOKEN_PREFIX}`.length));
}

export function authRoutes(db: Db) {
  const app = new Hono();

  // Any non-empty password works, except the literal "wrong", so the failure path is easy to trigger.
  app.post("/login", async (c) => {
    const parsed = parseBody(c, loginSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    const email = parsed.data.email.toLowerCase();
    const { password } = parsed.data;

    const user = db.state.users.find((u) => u.email.toLowerCase() === email);
    if (!user || password === "wrong") {
      db.log("login_failed", email, "system");
      return fail(c, 401, "invalid_credentials", "Incorrect email or password");
    }
    if (user.status === "suspended") return fail(c, 403, "account_suspended", "This account is suspended");

    return c.json({ data: { token: `${TOKEN_PREFIX}${user.id}`, user } });
  });

  app.post("/signup", async (c) => {
    const parsed = parseBody(c, signupSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    const { name } = parsed.data;
    const email = parsed.data.email.toLowerCase();

    if (db.state.users.some((u) => u.email.toLowerCase() === email)) {
      return fail(c, 422, "validation_failed", "Some fields are invalid", { email: "emailTaken" });
    }

    // Every new account starts in its own trial workspace and owns it.
    const org = { id: db.nextId("org"), name: `${name}'s workspace`, plan: "free" as const, status: "trialing" as const, createdAt: new Date().toISOString() };
    db.state.orgs.push(org);
    const user: User = {
      id: db.nextUserId(),
      name,
      initials: initials(name),
      email,
      orgId: org.id,
      role: "owner",
      status: "active",
      joinedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    db.state.users.push(user);
    db.log("signup", email, email);
    return c.json({ data: { token: `${TOKEN_PREFIX}${user.id}`, user } }, 201);
  });

  // Single sign-on is an enterprise feature: only users in an enterprise organization can use it.
  app.post("/sso", async (c) => {
    const parsed = parseBody(c, ssoSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;

    const email = parsed.data.email.toLowerCase();
    const user = db.state.users.find((u) => u.email.toLowerCase() === email);
    if (!user || db.org(user.orgId)?.plan !== "enterprise") {
      return fail(c, 403, "sso_not_enabled", "Single sign-on isn't enabled for this organization");
    }
    if (user.status === "suspended") return fail(c, 403, "account_suspended", "This account is suspended");
    return c.json({ data: { token: `${TOKEN_PREFIX}${user.id}`, user } });
  });

  // Always succeeds, so the response never reveals whether an address has an account.
  app.post("/forgot-password", async (c) => {
    const parsed = parseBody(c, forgotPasswordSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    return c.body(null, 204);
  });

  app.get("/me", (c) => c.json({ data: userFromRequest(c, db) ?? db.me }));

  app.patch("/me", async (c) => {
    const me = userFromRequest(c, db) ?? db.me;
    const parsed = parseBody(c, updateProfileSchema, await readBody(c));
    if (!parsed.ok) return parsed.response;
    const { name, email } = parsed.data;

    if (db.state.users.some((u) => u.id !== me.id && u.email.toLowerCase() === email.toLowerCase())) {
      return fail(c, 422, "validation_failed", "Some fields are invalid", { email: "emailTaken" });
    }

    me.name = name;
    me.initials = initials(name);
    me.email = email;
    return c.json({ data: me });
  });

  app.post("/logout", (c) => c.body(null, 204));

  return app;
}
