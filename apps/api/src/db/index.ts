import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export { schema };

/** The query builder both drivers expose: postgres.js in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function connect(url: string, { max = 10 }: { max?: number } = {}) {
  const client = postgres(url, { max, onnotice: () => {} });
  return { db: drizzle(client, { schema }) as Db, close: () => client.end({ timeout: 5 }) };
}
