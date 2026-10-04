import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { schema, type Db } from "./index";

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

interface Options {
  onQuery?: (query: string) => void;
}

/**
 * A migrated database for a test. By default it is PGlite, an in-process Postgres: the same SQL, no server
 * needed. With TEST_DATABASE_URL set it is a throwaway database on that real server instead, so the same
 * suite also runs against the production driver and server version.
 */
export async function createTestDb({ onQuery }: Options = {}) {
  const logger = onQuery ? { logQuery: onQuery } : false;
  const serverUrl = process.env.TEST_DATABASE_URL;

  if (!serverUrl) {
    const client = new PGlite({ extensions: { pg_trgm } });
    const db = drizzlePglite(client, { schema, logger });
    await migratePglite(db, { migrationsFolder });
    return { db: db as unknown as Db, close: () => client.close() };
  }

  const name = `trestle_test_${randomBytes(6).toString("hex")}`;
  const admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const client = postgres(url.toString(), { max: 5, onnotice: () => {} });
  const db = drizzlePostgres(client, { schema, logger });
  await migratePostgres(db, { migrationsFolder });

  return {
    db: db as unknown as Db,
    close: async () => {
      await client.end({ timeout: 2 });
      await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.end({ timeout: 2 });
    },
  };
}
