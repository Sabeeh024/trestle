import { createHash, timingSafeEqual } from "node:crypto";

import { getConnInfo } from "@hono/node-server/conninfo";
import { CLIENT_IP_HEADER, INTERNAL_KEY_HEADER } from "@trestle/auth/request";
import { lt, sql } from "drizzle-orm";
import type { Context } from "hono";

import { schema, type Db } from "../db";
import { fail } from "./http";

const { rateLimits } = schema;

/**
 * Fixed-window attempt counters kept in Postgres, so every API instance shares them and a restart does not
 * reset them. One atomic upsert per check.
 */
export class RateLimiter {
  constructor(private db: Db) {}

  /** Records an attempt; false once `key` is over `max` for the current window. */
  async hit(key: string, max: number, windowMs: number) {
    const resetAt = new Date(Date.now() + windowMs);
    const [row] = await this.db
      .insert(rateLimits)
      .values({ key, count: 1, resetAt })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.resetAt} <= now() then 1 else ${rateLimits.count} + 1 end`,
          resetAt: sql`case when ${rateLimits.resetAt} <= now() then excluded.reset_at else ${rateLimits.resetAt} end`,
        },
      })
      .returning({ count: rateLimits.count });

    // Expired counters are swept now and then, so the table stays small without a separate job.
    if (Math.random() < 0.01) await this.db.delete(rateLimits).where(lt(rateLimits.resetAt, sql`now()`));
    return (row?.count ?? 1) <= max;
  }

  async clear(key: string) {
    await this.db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
  }
}

/**
 * The client's address, from the most trustworthy source available:
 * 1. a web server of ours that proves itself with the shared key and says which visitor it is acting for;
 * 2. X-Forwarded-For, but only as far as `TRUST_PROXY` says how many proxies of ours appended to it, because the
 *    entry that many places from the right is the one the outermost trusted proxy saw and the rest is whatever
 *    the client wrote;
 * 3. the connection's own address.
 */
export function clientIp(c: Context, { TRUST_PROXY, INTERNAL_API_KEY }: { TRUST_PROXY: number; INTERNAL_API_KEY?: string | undefined }): string {
  const claimed = c.req.header(CLIENT_IP_HEADER);
  const presented = c.req.header(INTERNAL_KEY_HEADER);
  if (INTERNAL_API_KEY && presented && claimed && sameSecret(presented, INTERNAL_API_KEY)) return claimed.slice(0, 64);

  if (TRUST_PROXY > 0) {
    const parts = (c.req.header("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const ip = parts[parts.length - TRUST_PROXY];
    if (ip) return ip;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

function sameSecret(a: string, b: string) {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

export type Limit = readonly [key: string, max: number, windowMs: number];

const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** The policy for each public or abusable endpoint, in one place. */
export const limits = {
  login: (ip: string, email: string): Limit[] => [
    [`login:ip+email:${ip}:${email}`, 10, 15 * MINUTE],
    // Per address alone, so one client cannot spray many accounts; per account alone, so many clients cannot
    // all guess one account's password.
    [`login:ip:${ip}`, 50, 15 * MINUTE],
    [`login:email:${email}`, 30, 15 * MINUTE],
  ],
  signup: (ip: string): Limit[] => [[`signup:ip:${ip}`, 10, HOUR]],
  forgotPassword: (ip: string, email: string): Limit[] => [
    [`forgot:email:${email}`, 3, HOUR],
    [`forgot:ip:${ip}`, 20, HOUR],
  ],
  resetPassword: (ip: string): Limit[] => [[`reset:ip:${ip}`, 20, 15 * MINUTE]],
  contact: (ip: string): Limit[] => [[`contact:ip:${ip}`, 10, HOUR]],
  invite: (userId: string): Limit[] => [[`invite:user:${userId}`, 50, HOUR]],
  changePassword: (userId: string): Limit[] => [[`change-password:user:${userId}`, 10, 15 * MINUTE]],
  cspReport: (ip: string): Limit[] => [[`csp:ip:${ip}`, 60, MINUTE]],
};

/** Counts the attempt against every limit; a 429 response if any is exceeded, otherwise undefined. */
export async function enforce(c: Context, limiter: RateLimiter | false, list: Limit[]) {
  if (!limiter) return undefined;
  let allowed = true;
  // All of them are counted even after one fails, so a blocked client keeps burning its own budget.
  for (const [key, max, windowMs] of list) if (!(await limiter.hit(key, max, windowMs))) allowed = false;
  return allowed ? undefined : fail(c, 429, "rate_limited", "Too many attempts. Try again later.");
}
