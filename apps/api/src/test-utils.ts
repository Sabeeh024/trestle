import { operations, type OperationName } from "@trestle/api-client/operations";

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
    limiter: false,
    config: { WEB_APP_URL: "http://web.test" },
    ...options,
  });

  type RequestOptions = { token?: string; headers?: Record<string, string> };

  /** Posts raw text to the GraphQL endpoint, for tests of the endpoint itself. */
  async function post(body: string, { token, headers }: RequestOptions = {}) {
    const res = await app.request("/api/graphql", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body,
    });
    const text = await res.text();
    return { http: res.status, body: (text ? JSON.parse(text) : undefined) as Json, headers: res.headers };
  }

  /**
   * Runs one of the client's own operations, so the tests exercise exactly what the apps send. `status` is the status
   * an operation reports (404, 422... as `extensions.status`, or 200); `http` is the transport's.
   */
  async function call(name: OperationName, variables: Record<string, unknown> = {}, options: RequestOptions = {}) {
    const op = operations[name];
    const res = await post(JSON.stringify({ query: op.query, operationName: op.name, variables }), options);
    const error = res.body?.errors?.[0] as { message: string; extensions: { code: string; status: number; fields?: Record<string, string> } } | undefined;
    return {
      http: res.http,
      status: error ? error.extensions.status : 200,
      data: res.body?.data?.[op.field] as Json,
      error: error ? { ...error.extensions, message: error.message } : undefined,
      body: res.body as Json,
      headers: res.headers,
    };
  }

  const login = async (email: string, password = PASSWORD) => {
    const res = await call("login", { input: { email, password } });
    if (res.error) throw new Error(`login as ${email} failed: ${res.status} ${JSON.stringify(res.error)}`);
    return res.data.token as string;
  };

  const reset = async () => {
    await truncateAll(db);
    await seed(db, PASSWORD);
    mails.length = 0;
  };
  await reset();

  return { db, app, mails, queries, call, post, login, reset, close };
}

/** The token inside the most recent emailed link. */
export const tokenFromMail = (mail: Mail | undefined) => /token=([\w-]+)/.exec(mail?.text ?? "")?.[1];
