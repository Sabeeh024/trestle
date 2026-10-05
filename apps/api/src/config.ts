import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default("postgres://trestle:trestle@localhost:5432/trestle"),
  // Comma-separated origins allowed to call the API from a browser (the admin panel is a SPA).
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:5173"),
  SESSION_TTL_DAYS: z.coerce.number().positive().default(30),
  // Where the emailed set-password and reset links point.
  WEB_APP_URL: z.string().default("http://localhost:3000"),
  // Development only: lets enterprise users sign in with SSO without an identity provider.
  DEV_SSO: z.enum(["0", "1"]).default("0"),
  // Password given to every seeded account by `db:seed`.
  SEED_PASSWORD: z.string().min(8).default("trestle-dev-1"),
  // How many reverse proxies sit in front of the API. 0 trusts nothing: the client address is the socket's, and
  // X-Forwarded-For is ignored. With N, the address N entries from the right of X-Forwarded-For is used.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // A secret shared with the web apps' servers. A request that presents it may say which client address it is
  // acting for (X-Client-IP), so per-address rate limits count the real visitor and not the web server. Generate a
  // long random value and give the same one to the apps as INTERNAL_API_KEY. Unset, every caller is judged by
  // its own connection.
  INTERNAL_API_KEY: z.string().min(16).optional(),
  // Where the admin panel's production build is (its `dist` folder). Set, the API serves the panel from its own
  // origin, so the panel and its session cookie share a site without any domain or CORS.
  ADMIN_DIST: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const config = schema.parse(env);
  if (config.NODE_ENV === "production" && config.DEV_SSO === "1") {
    throw new Error("DEV_SSO must not be enabled in production");
  }
  return config;
}
