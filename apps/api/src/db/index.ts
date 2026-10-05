import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export { schema };

/** The query builder both drivers expose: postgres.js in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface ConnectOptions {
  /** Pool size. Keep it small on a hosted database with a connection limit. */
  max?: number;
  /**
   * Use server-side prepared statements. They are faster, but a connection pooler in transaction mode (a "pooled"
   * connection string) may not support them, in which case turn this off. Current Neon poolers do support them.
   */
  prepare?: boolean;
}

export function connect(url: string, { max = 10, prepare = true }: ConnectOptions = {}) {
  const client = postgres(url, {
    max,
    prepare,
    onnotice: () => {},
    // A hosted database that scales to zero takes several seconds to wake on the first connection.
    connect_timeout: 30,
  });
  return { db: drizzle(client, { schema }) as Db, close: () => client.end({ timeout: 5 }) };
}
