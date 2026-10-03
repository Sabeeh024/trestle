import { Hono, type Context } from "hono";

import type { Db } from "../db";
import { badRequest, fail, readBody, str } from "../http";
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
    const body = await readBody(c);
    const email = str(body.email)?.toLowerCase();
    const password = str(body.password);
    if (!email || !password) return badRequest(c, "email and password are required");

    const user = db.state.users.find((u) => u.email.toLowerCase() === email);
    if (!user || password === "wrong") {
      db.log("login_failed", email, "system");
      return fail(c, 401, "invalid_credentials", "Incorrect email or password");
    }
    if (user.status === "suspended") return fail(c, 403, "account_suspended", "This account is suspended");

    return c.json({ data: { token: `${TOKEN_PREFIX}${user.id}`, user } });
  });

  app.get("/me", (c) => c.json({ data: userFromRequest(c, db) ?? db.me }));

  app.post("/logout", (c) => c.body(null, 204));

  return app;
}
