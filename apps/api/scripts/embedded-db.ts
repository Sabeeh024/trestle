// A real PostgreSQL server for development without Docker. Data lives in apps/api/.pgdata and survives restarts.
// Credentials match the default DATABASE_URL: postgres://trestle:trestle@localhost:5432/trestle
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import EmbeddedPostgres from "embedded-postgres";

const databaseDir = fileURLToPath(new URL("../.pgdata", import.meta.url));
const port = Number(process.env.PGPORT ?? 5432);

const pg = new EmbeddedPostgres({ databaseDir, user: "trestle", password: "trestle", port, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"], onLog: () => {}, onError: console.error });

if (!existsSync(`${databaseDir}/PG_VERSION`)) await pg.initialise();
await pg.start();
try {
  await pg.createDatabase("trestle");
} catch {
  // Already exists.
}
console.log(`PostgreSQL is running: postgres://trestle:trestle@localhost:${port}/trestle (Ctrl+C to stop)`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
