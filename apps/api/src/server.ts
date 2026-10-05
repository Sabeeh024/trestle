import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { loadConfig } from "./config";
import { connect } from "./db";

const config = loadConfig();
const { db, close } = connect(config.DATABASE_URL, { max: config.DB_POOL_MAX });

const app = createApp({
  db,
  config,
  ...(config.ADMIN_DIST ? { adminDist: config.ADMIN_DIST } : {}),
  secureCookies: config.NODE_ENV === "production",
  corsOrigins: config.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  log: config.NODE_ENV !== "production",
});

const server = serve({ fetch: app.fetch, port: config.PORT }, ({ port }) => {
  console.log(`Trestle API listening on http://localhost:${port}`);
});

// Finish in-flight requests, then release the pool, so a deploy does not drop connections mid-query.
const shutdown = () => {
  server.close(() => void close().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
