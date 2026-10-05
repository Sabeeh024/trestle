# Deployment

How Trestle goes from a commit to something running, and what each environment is for. This is **Phase 1**: it needs
no domain and no cloud account. Phases 2 and 3 are at the end.

## The pieces

| Piece | Where | What it is |
|---|---|---|
| `Dockerfile` | repo root | One file, three images: `api`, `web-app`, `marketing-app` (`--target`). Dependencies are installed in a cached layer, so editing source only repeats the build. |
| `docker-compose.stack.yml` | repo root | The whole product as containers: PostgreSQL, a one-shot `migrate`, the API, both Next apps, and a Caddy reverse proxy. |
| `deploy/Caddyfile` | `deploy/` | One host name per app, HTTPS from Caddy's own local certificate authority. |
| `scripts/smoke.sh` | `scripts/` | Signs in and checks the product and its production protections end to end (26 checks). |
| `.github/workflows/ci.yml` | CI | Verifies every push, rehearses the stack, and publishes images from `main`. |
| `.env.stack.example` | repo root | The configuration the stack needs. Copy to `.env`. |

`docker-compose.yml` (just PostgreSQL) is for day-to-day development. `docker-compose.stack.yml` is the production-like
one.

## How it is shaped, and why

- **The admin panel is served by the API.** Free hosting URLs are each their own "site", so a panel and an API on
  different hosts could not share a session cookie. Serving the panel's static files from the API's origin makes
  them one origin: the cookie is `__Host-` prefixed and `Secure`, there is no CORS and no preflight, and the panel is
  built once with a relative API address (`VITE_API_URL` empty), so the same build runs in every environment.
- **The API is bundled into plain JavaScript** (`apps/api/scripts/build.mjs`) and run with `node dist/server.js`: no
  TypeScript runtime and no source in the image. Real npm dependencies are installed in the image from the lockfile.
- **Migrations are a release step, not startup.** `migrate` runs `node dist/migrate.js` and exits; the API waits for it
  to succeed. Several instances starting at once therefore cannot race each other. Migrations must be backwards
  compatible (add things, never drop or rename in the same release) because the old and new API run side by side
  during a rollout. Roll back by redeploying the previous image and writing a forward-fix migration, never a down-migration.
- **Containers run as a non-root user**, publish nothing but the proxy, and report health, which the stack waits on.
- **Secrets are never in images or the repository.** They come from `.env` (locally) or the platform's secret store.

## Run it locally

You need Docker (Docker Desktop on Windows or macOS).

```bash
cp .env.stack.example .env          # then replace the secrets: openssl rand -hex 32
docker compose -f docker-compose.stack.yml up -d --build
docker compose -f docker-compose.stack.yml run --rm seed      # demo data; every account's password is trestle-dev-1
bash scripts/smoke.sh
```

Then open `https://trestle.localhost` (marketing), `https://app.trestle.localhost` (product app) and
`https://admin.trestle.localhost` (admin panel). Caddy's certificate is signed by its own authority, which your
browser does not trust yet, so you will see a warning. To trust it:

```bash
docker compose -f docker-compose.stack.yml cp proxy:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt
```

and import `caddy-root.crt` into your system or browser certificate store. `*.localhost` names resolve to your own
machine in current browsers, so no DNS or hosts-file change is needed.

## Environments

| Environment | Purpose | Data | How it gets there |
|---|---|---|---|
| Local | Development | Seed (`pnpm db:reset`) | You, with `pnpm dev` |
| CI | Verification | Throwaway database per test | Every pull request and push |
| Rehearsal / staging | Does it work as deployed? | Seed | The `stack` job in CI, and `docker compose` locally |
| Production | Real users | Real | Not yet (Phase 2) |

Production is the same images with real secrets, a real database, and a real domain. Nothing in the images knows
which environment it is in; configuration arrives as environment variables.

## CI/CD

1. **Verify** (every push and pull request): install from the frozen lockfile, type-check, lint, test (also on a real
   PostgreSQL service), build everything, scan the client bundles for secrets, audit dependencies, run gitleaks.
2. **Stack** (every push and pull request): build the three images, start the stack, run migrations on an empty
   database, load demo data, run `scripts/smoke.sh`. Logs are printed if anything fails.
3. **Publish** (`main` only, after everything above passes): push the images to GitHub's container registry tagged with
   the commit SHA (and `main`). It is the only job allowed to write packages. What gets deployed later is exactly
   what passed.
4. **Deploy** (Phase 2): promote a SHA to staging automatically, run the smoke test against it, then to production
   behind a manual approval (a GitHub Environment).

## Configuration

| Variable | Service | Meaning |
|---|---|---|
| `DATABASE_URL` | api, migrate | PostgreSQL connection string |
| `INTERNAL_API_KEY` | api, web-app, marketing-app | Shared secret. A request that presents it may say which visitor it is acting for, so rate limits count visitors and not the Next server |
| `TRUST_PROXY` | api | Number of proxies in front of the API (`1` behind Caddy) |
| `ADMIN_DIST` | api | Where the admin panel's build is (set in the image) |
| `MIGRATIONS_DIR` | migrate | Where the SQL migrations are (set in the image) |
| `WEB_APP_URL` | api | Where emailed reset and invitation links point |
| `CORS_ORIGINS` | api | Other browser origins allowed to call the API (none needed when the panel is served by it) |
| `API_URL` | web-app, marketing-app | Where the Next servers reach the API (`http://api:4000` inside the stack) |
| `DOMAIN` | proxy, api | Base host name (`trestle.localhost` locally) |

`apps/api/.env.example` lists the rest, with explanations.

## What was and was not verified

- **Run and passing:** the API bundle (`pnpm --filter api build`) running as plain `node` against real PostgreSQL with
  `NODE_ENV=production`, migrating, seeding and serving the admin panel on one origin; both Next apps as standalone
  servers; and `scripts/smoke.sh` (26 checks) against those behind a local HTTPS proxy that routes by host name like
  Caddy does. The smoke test was also confirmed to fail, with a non-zero exit code, when something is wrong.
- **Written but not run:** the `Dockerfile`, `docker-compose.stack.yml`, `deploy/Caddyfile` and the new CI jobs. Docker was
  not available on the machine they were written on, so **the first CI run is their first execution**. Expect to fix
  small things (a missing file in a `COPY`, a wait that is too short) on that run.

## Later phases

- **Phase 2, real cloud on free tiers:** the API (with the panel) on Render or Fly, PostgreSQL on Neon, the Next apps
  on Vercel. Two copies (staging and production), promoted by SHA. Free tiers sleep when idle, so the first request
  is slow.
- **Phase 3, a domain (optional):** teaches DNS, public certificates and subdomain-level same-site behaviour. Set
  `DOMAIN` and Caddy obtains public certificates; nothing else changes.
