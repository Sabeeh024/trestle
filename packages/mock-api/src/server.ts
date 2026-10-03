import { serve } from "@hono/node-server";

import { createApp } from "./app";

const port = Number(process.env.PORT ?? 4000);

const app = createApp({
  latencyMs: Number(process.env.MOCK_LATENCY_MS ?? 150),
  requireAuth: process.env.MOCK_REQUIRE_AUTH === "1",
  log: true,
});

serve({ fetch: app.fetch, port }, ({ port }) => {
  console.log(`Trestle mock API listening on http://localhost:${port}`);
});
