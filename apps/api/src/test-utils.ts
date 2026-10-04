import { createApp, type AppOptions } from "./app";
import { createTestDb } from "./db/test-db";
import { seed, truncateAll } from "./db/seed";
import type { Mail } from "./lib/mailer";

export const PASSWORD = "Passw0rd!";

export const EMAIL = {
  jordan: "jordan.kim@trestle.io", // owner of the platform organization
  jamie: "jamie.singh@trestle.io", // member, same organization
  alex: "alex.kim@northwind.io", // admin of another organization
  elena: "elena.cho@northwind.io", // member of that organization
  maya: "maya@fontaineco.com", // member
  tom: "tom.baker@haldane.co", // suspended
  sam: "sam.r@umbralabs.dev", // invited, no password yet
  noah: "noah@fontaineco.com", // invited viewer
};

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A seeded in-process Postgres plus the app on top of it, with a tiny request helper. */
export async function setup(options: Partial<AppOptions> = {}) {
  const queries: string[] = [];
  const { db, close } = await createTestDb({ onQuery: (query) => void queries.push(query) });
  const mails: Mail[] = [];
  const app = createApp({
    db,
    mailer: { send: async (mail) => void mails.push(mail) },
    loginLimiter: false,
    config: { WEB_APP_URL: "http://web.test" },
    ...options,
  });

  async function request(method: string, path: string, { token, body, headers }: { token?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const res = await app.request(path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : undefined) as Json };
  }

  const login = async (email: string, password = PASSWORD) => {
    const res = await request("POST", "/api/auth/login", { body: { email, password } });
    if (res.status !== 200) throw new Error(`login as ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.data.token as string;
  };

  const reset = async () => {
    await truncateAll(db);
    await seed(db, PASSWORD);
    mails.length = 0;
  };
  await reset();

  return { db, app, mails, queries, request, login, reset, close };
}

/** The token inside the most recent emailed link. */
export const tokenFromMail = (mail: Mail | undefined) => /token=([\w-]+)/.exec(mail?.text ?? "")?.[1];
