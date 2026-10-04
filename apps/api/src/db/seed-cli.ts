import { sql } from "drizzle-orm";

import { loadConfig } from "../config";
import { connect, schema } from "./index";
import { seed, truncateAll } from "./seed";

const config = loadConfig();
const reset = process.argv.includes("--reset");
const { db, close } = connect(config.DATABASE_URL, { max: 1 });

if (config.NODE_ENV === "production") {
  console.error("Refusing to seed a production database");
  process.exit(1);
}

const [existing] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(schema.organizations);
if ((existing?.n ?? 0) > 0 && !reset) {
  console.log("Database already has data. Use `pnpm db:reset` to wipe it and reseed.");
} else {
  if (reset) await truncateAll(db);
  await seed(db, config.SEED_PASSWORD);
  console.log(`Seeded demo data. Every account's password is "${config.SEED_PASSWORD}".`);
}
await close();
