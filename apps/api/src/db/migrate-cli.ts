import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { loadConfig } from "../config";

const client = postgres(loadConfig().DATABASE_URL, { max: 1, onnotice: () => {} });
// In the production bundle the SQL files sit beside it, not two folders up from the source, so the image says where.
const migrationsFolder = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../../drizzle", import.meta.url));
await migrate(drizzle(client), { migrationsFolder });
await client.end();
console.log("Migrations applied");
