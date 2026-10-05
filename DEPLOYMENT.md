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
| Rehearsal | Do the images work together? | Seed | The `stack` job in CI, and `docker compose` locally |
| Staging | Does it work on the real services? | Seed (`Seed staging` workflow) | Automatically when CI passes on `main` (Phase 2) |
| Production | Real users | Real | The same commit, after a person approves it (Phase 2) |

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
4. **Deploy** (Phase 2, `deploy.yml`): promote that SHA to staging automatically, smoke-test it there, then to production
   behind a manual approval (a GitHub Environment). See Phase 2 below.

## Configuration

| Variable | Service | Meaning |
|---|---|---|
| `DATABASE_URL` | api, migrate | PostgreSQL connection string |
| `INTERNAL_API_KEY` | api, web-app, marketing-app | Shared secret. A request that presents it may say which visitor it is acting for, so rate limits count visitors and not the Next server |
| `TRUST_PROXY` | api | Number of proxies in front of the API (`1` behind Caddy) |
| `ADMIN_DIST` | api | Where the admin panel's build is (set in the image) |
| `MIGRATIONS_DIR` | migrate | Where the SQL migrations are (set in the image) |
| `WEB_APP_URL` | api | Where emailed reset and invitation links point |
| `CORS_ORIGINS` | api | Other browser origins allowed to call the API. Defaults to none in production, because the panel is served by the API |
| `APP_VERSION` | api | The git commit running; baked into the image, reported by `/health` so a deploy can prove it is live |
| `DB_PREPARE` | api | `0` if the database connection goes through a pooler without prepared-statement support (Neon's does support them) |
| `API_URL` | web-app, marketing-app | Where the Next servers reach the API (`http://api:4000` inside the stack) |
| `DOMAIN` | proxy, api | Base host name (`trestle.localhost` locally) |

`apps/api/.env.example` lists the rest, with explanations.

## What was and was not verified

- **Run and passing:** the API bundle (`pnpm --filter api build`) running as plain `node` against real PostgreSQL with
  `NODE_ENV=production`, migrating, seeding and serving the admin panel on one origin; both Next apps as standalone
  servers; and `scripts/smoke.sh` (26 checks) against those behind a local HTTPS proxy that routes by host name like
  Caddy does. The smoke test was also confirmed to fail, with a non-zero exit code, when something is wrong.
- **Phase 2 (cloud), checked without the providers:** every workflow and `render.yaml` parse as valid YAML; the deploy
  planning logic was run for five scenarios (CI success on a push, CI failure, a pull request, a manual run with and
  without a SHA); the smoke test was run with `EXPECT_VERSION`, `WAIT_SECONDS`, `SMOKE_LEVEL=basic` and explicit URLs,
  and fails on a wrong version; and the deploy flow, hook parameters and Blueprint fields were checked against the
  Render, Vercel and Neon documentation. **Nothing has run on Render, Vercel, Neon or GitHub Actions.**
- **Written but not run:** the `Dockerfile`, `docker-compose.stack.yml`, `deploy/Caddyfile` and the new CI jobs. Docker was
  not available on the machine they were written on, so **the first CI run is their first execution**. Expect to fix
  small things (a missing file in a `COPY`, a wait that is too short) on that run.

## Phase 2: real cloud on free tiers

The same images, running on real services. Nothing here needs a domain, and each service has a free plan that is
enough for learning (check each provider's current sign-up terms, since I could not confirm whether a card is asked for).

```
                       GitHub Actions
   push to main ──► CI ──► publish images (SHA-tagged) ──► Deploy workflow
                                                              │
                  ┌───────────────── staging ────────────────┤ (automatic, smoke-tested)
                  │                                           │
                  │            approval by a person           ▼
                  │                                      production  (smoke-tested, read-only)
                  ▼
   Vercel (web-app, marketing-app)  ──server-to-server──►  Render (API + admin panel)  ──►  Neon (PostgreSQL)
```

| Piece | Service | Free-tier behaviour to know |
|---|---|---|
| Product app, marketing site | Vercel (Hobby plan, for non-commercial use) | Each app is its own project, so four projects in total (each app in each environment) |
| API and admin panel | Render web service, from our container image | Sleeps after 15 minutes without traffic and takes about a minute to wake; 750 free instance hours a month per workspace |
| Database | Neon | 1 GB per project; idle compute suspends after 5 minutes and wakes on the next query |
| Images | GitHub container registry | Free for public packages |

Every environment has **its own** database, API, web projects, keys and secrets. Staging and production share only code.

### How a release flows

1. A commit lands on `main`. **CI** verifies it, rehearses the stack, and **publishes** images tagged with the commit SHA.
2. When CI succeeds, the **Deploy** workflow takes that same SHA to **staging**: it applies migrations to the staging
   database, tells Render to run that image tag, waits until `/health` reports that exact SHA, builds and uploads both
   web apps to Vercel, and runs the smoke test against the public URLs.
3. If staging passes, the run **waits for approval**. Approving it repeats the same steps for **production**, with a
   read-only smoke test (production has no demo account to sign in with).
4. To redeploy or **roll back**, run **Deploy** manually and choose the environment and the SHA you want.

Migrations run *before* the new API starts, while the old one is still serving. Every migration must therefore only
add to the schema (a new table, a new nullable column), never drop or rename: the previous version has to keep
working against the migrated database, which is what makes a rollback safe.

### One-time setup

Do these in order. The names matter, because the workflows read them.

**1. GitHub**
- Push the repository and let CI run on `main` once. Then open each published package (your profile, Packages,
  `trestle/api`, `trestle/web-app`, `trestle/marketing-app`, Package settings) and set its visibility to **Public**,
  so Render can pull the API image without credentials. (Or keep them private and add a registry credential in
  Render, using a token that can read packages.)
- Settings, Environments: create **`staging`** and **`production`**. On `production`, add yourself under **Required
  reviewers**. This is what makes production wait for you. **Without it, production deploys as soon as staging
  passes.** (Required reviewers on private repositories needs a paid GitHub plan; public repositories can use it for free.)

**2. Neon** (one project per environment)
- Create `trestle-staging` and `trestle-production`. For each, copy two connection strings from the Connect dialog:
  the **pooled** one (the host contains `-pooler`) and the **direct** one. Both need `sslmode=require`.
- The `pg_trgm` extension that migration `0000` creates is available on Neon.

**3. Render**
- New, Blueprint, choose this repository. It reads `render.yaml` and creates `trestle-api-staging` and
  `trestle-api-production`. When prompted, enter for each service:
  - `DATABASE_URL`: that environment's **pooled** Neon string
  - `INTERNAL_API_KEY`: a new random value (`openssl rand -hex 32`). Use a **different** one per environment, and keep
    it: the matching Vercel projects need the same value
  - `WEB_APP_URL`: that environment's web app URL (you can set it after step 4)
- In each service, Settings, Deploy Hook: copy the URL. Note each service's public URL (`https://<name>.onrender.com`).
- The image URL in `render.yaml` must match what CI publishes (`ghcr.io/<owner>/trestle/api`, lower case). Edit the
  owner there if yours is not `sabeeh024`.

**4. Vercel** (four projects: `trestle-web-staging`, `trestle-web-production`, `trestle-marketing-staging`,
`trestle-marketing-production`)
- For each: import the repository, set **Root Directory** to `apps/web-app` or `apps/marketing-app`, and keep the
  settings from that app's `vercel.json`. Disconnect the Git integration (Settings, Git), so a push does not also
  deploy: the workflow deploys.
- Environment variables, **Production** scope. Web-app projects: `API_URL` (that environment's Render URL),
  `INTERNAL_API_KEY` (the same value as that environment's API), `SESSION_TTL_DAYS=30`. Marketing projects: `API_URL`
  and `INTERNAL_API_KEY`.
- In Settings, Deployment Protection, make sure the production domain stays public.
- Note the **Org ID** and each **Project ID** (Settings), and create an access token (Account Settings, Tokens).

**5. GitHub secrets and variables**

| Where | Name | Value |
|---|---|---|
| Repository secret | `VERCEL_TOKEN`, `VERCEL_ORG_ID` | from Vercel |
| Environment secret (each) | `DATABASE_URL_DIRECT` | that environment's **direct** Neon string (migrations need it) |
| Environment secret (each) | `RENDER_DEPLOY_HOOK_URL` | that service's deploy hook |
| Environment secret (each) | `VERCEL_WEB_PROJECT_ID`, `VERCEL_MARKETING_PROJECT_ID` | that environment's Vercel project IDs |
| Environment secret (`staging`) | `SEED_PASSWORD` | optional: password for the demo accounts |
| Environment variable (each) | `API_PUBLIC_URL`, `WEB_PUBLIC_URL`, `MARKETING_PUBLIC_URL` | the public URLs, without a trailing slash |

**6. First deploy**
- Merge to `main`. Staging deploys. Its smoke test signs in as a demo user and the staging database is empty, so
  **that first smoke test fails**. Run **Seed staging** (Actions tab), then re-run the failed Deploy job.
- Approve production when it asks. Production's read-only smoke test needs no data.
- Production has no accounts yet. Creating the first administrator is an open item (see `TODO.md`).

**7. Calibrate `TRUST_PROXY`** (the API needs to know how many proxies sit in front of it)
- Render's proxies add to `X-Forwarded-For`, and I could not confirm from its documentation how many entries come
  before the client address, so measure it. Send a failed sign-in with a forged header:
  `curl -s -X POST https://<api>/api/auth/login -H 'content-type: application/json' -H 'X-Forwarded-For: 203.0.113.9' -d '{"email":"x@y.zz","password":"nope"}'`
  then, in Neon's SQL editor, run `select key from rate_limits where key like 'login:ip:%';`.
  If a key contains `203.0.113.9`, the setting is too low (the API is trusting what you wrote), so raise `TRUST_PROXY`
  by one. If it contains your real address, it is right. The web apps are unaffected, because they report the visitor
  through `INTERNAL_API_KEY`; this matters for the admin panel and any direct caller.

### Rollback

Actions, Deploy, Run workflow: choose the environment and the SHA of the last good version (any commit on `main` that CI
published). The API and web apps go back, and the database stays migrated, which is safe because migrations only add.
If a release needs a schema change undone, fix forward with a new migration.

### Known limits and gotchas

- **Cold starts.** The first request after idle waits about a minute for Render, and a few seconds more if Neon has
  suspended. The deploy workflow and the smoke test allow for this.
- **No real email.** The mailer still prints to the console, so reset and invitation links appear in the Render service
  logs, not in an inbox.
- **Vercel Hobby is for non-commercial use.** Fine for learning.
- **Each web app is its own site.** That is fine here because they keep their session token on their own server. Only
  the admin panel needs the same-site arrangement, and it gets it by being served by the API.

## Phase 3 (optional): a domain

Teaches DNS, public certificates and subdomain-level same-site behaviour. Set `DOMAIN` (and the Vercel and Render
custom domains) and nothing else changes.
