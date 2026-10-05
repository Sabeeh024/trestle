# TODO

What is not done yet, as of the `feat/auth-hardening` branch. Items are grouped by when they matter, and each says
why it is open. Tick them off (or delete them) as they land.

## Before anything is shared or merged

- [ ] **Merge the branches.** Nothing has been pushed. The work is a stack, so merge in this order:
  `feat/backend-postgres`, then `feat/auth-hardening`, then `feat/deploy-stack` (each builds on the one before).
  `feat/complete-screens` is already in `main`. Push, open a pull request for each, and let CI run.
- [ ] **Run CI for the first time.** `.github/workflows/ci.yml` has never run on GitHub. Check in particular that
  `pnpm/action-setup` reads `pnpm@12.5.1` from `package.json`, that the Postgres service job works, and that
  `gitleaks` has what it needs. Then turn on branch protection so the checks are required.
- [ ] **Review the changesets.** `.changeset/*.md` were written by hand across several commits. Run
  `pnpm changeset status` and read them once before releasing anything.

## Security (from the audit)

- [ ] **MFA** (deferred on purpose). TOTP first, passkeys later. Needs: a `user_mfa` table, an encryption key for the
  stored secrets (`MFA_ENCRYPTION_KEY`, with a rotation plan), a two-step login (the password step returns a
  challenge, the code step returns the session; this changes the login contract in `@trestle/api-client` and both
  login forms), recovery codes, rate limiting on the code step, re-authentication to change it, an admin reset for
  people locked out, and a decision on making it mandatory for owners and admins.
- [ ] **Breached-password check** (deferred on purpose). Have I Been Pwned range API (k-anonymity) at sign-up,
  reset and change. Decide fail-open or fail-closed when the service is down (fail-open recommended), add a
  `passwordBreached` message in English and Urdu, and give the outbound request a short timeout.
- [ ] **Turn the CSP from report-only to enforcing.** web-app and admin-panel send `Content-Security-Policy-Report-Only`.
  Run a deployed build, watch the reports, then switch the header name. Send reports to a real error-monitoring
  service instead of the console.
- [ ] **marketing-app has no script CSP.** Its pages are static, so a per-request nonce would make them dynamic. Decide:
  accept the gap, make the pages dynamic, or use hashes or Next's SRI support.
- [ ] **Account enumeration (F14).** Sign-up (`emailTaken`) and invite (409) reveal whether an email has an account.
  Usually accepted for sign-up; decide whether to change it.
- [ ] **Browser calls after a session ends.** Server pages now redirect to sign-in when the API says 401, but
  client-side calls made through the BFF (React Query) just fail. Redirect or show a "session ended" message there too.
- [ ] **Audit entries for password changes and device sign-outs.** The audit enum has no `change_password` /
  `revoke_session`; adding them needs a migration, the shared `AuditAction` type and the admin audit-log labels.
- [ ] **Notify people of security changes.** Email on password change and on a sign-in from a new device.
- [ ] **Run the secret scan over git history locally** (`gitleaks detect`). CI does it on every push, but it has not
  been run against the existing history.
- [ ] **Real mailer.** `apps/api/src/lib/mailer.ts` only prints to the console, so reset and invitation emails are
  not actually sent. Add an SMTP or API-backed implementation.
- [ ] **SSO.** `/api/auth/sso` answers 501 for enterprise users until an identity provider (OIDC) is wired up.
  `DEV_SSO=1` is a local-only shortcut.

## Deployment and operations

Phase 1 (containers, a Compose stack behind HTTPS, a smoke test, CI publishing) is written; see `DEPLOYMENT.md`.

- [ ] **Run the Docker pieces for the first time.** The `Dockerfile`, `docker-compose.stack.yml`, `deploy/Caddyfile` and the
  `stack` and `publish` CI jobs were written without Docker available, so they have never run. The first CI run is their
  first execution; expect to fix small things. Locally: install Docker Desktop, then follow `DEPLOYMENT.md`. What *was*
  verified: the API bundle as plain `node` with `NODE_ENV=production`, both standalone Next servers, and the 26-check
  smoke test through a stand-in HTTPS proxy.
- [ ] **Confirm the `docker compose` details on a real engine:** that `depends_on: service_completed_successfully`
  gates the API on `migrate`, that the `*.localhost` certificates work in your browser after trusting Caddy's root, and
  that image sizes are reasonable (slim base, no dev dependencies).
- [ ] **Phase 2: real cloud on free tiers.** API (with the admin panel) on Render or Fly, PostgreSQL on Neon, the Next
  apps on Vercel. Staging and production copies promoted by SHA, with an approval step (a GitHub Environment) before
  production, and the smoke test run against each. Free tiers sleep when idle.
- [ ] **Phase 3 (optional): a domain.** Teaches DNS, public certificates and subdomain-level same-site behaviour.
- [ ] **Add the deploy workflow.** Promote a published SHA to staging, run `scripts/smoke.sh` against it, then production
  behind approval; document rollback (redeploy the previous SHA; fix forward in the database).
- [ ] **Migration safety.** Add a CI test that upgrades a database created from the *previous* release's schema, not only
  from empty, and a rule (in review) that a release only adds to the schema (expand/contract).
- [ ] **Image hygiene.** Scan the images for vulnerabilities in CI, pin the base image by digest, and add layer caching
  to the CI build.
- [ ] **Production configuration.** Set `NODE_ENV=production`, `DATABASE_URL`, `WEB_APP_URL`, `SESSION_TTL_DAYS`,
  `TRUST_PROXY` (the number of proxies in front of the API), and the same `INTERNAL_API_KEY` in the API and in both
  Next apps. `CORS_ORIGINS` is empty while the admin panel is served by the API. Keep staging and production secrets
  separate.
- [ ] **Create the first production admin.** `db:seed` refuses to run in production, so the first owner and the
  platform organization (`organizations.is_platform`) need a one-off script or manual insert.
- [ ] **Headers at the real edge.** Confirm HSTS and TLS where the traffic really terminates. No browser source maps are
  published (the admin and Next builds make none). The API image does contain `dist/*.map`, which is server-side only and
  never served; keep it that way, or drop them from the image.
- [ ] **Backups, restore drill, secret rotation, incident contact.** None are documented yet.
- [ ] **Error monitoring and alerting.** Failed sign-ins are audited but nothing alerts on them.
- [ ] **`pg_trgm` in production.** Migration `0000` runs `CREATE EXTENSION pg_trgm`, which needs a role that may
  create extensions (the default on managed Postgres). Confirm on the chosen provider.
- [ ] **Rate-limit store.** Counters live in Postgres; if traffic grows, consider Redis. Expired rows are swept
  randomly, so check the table does not grow.

## Performance (from the 2026-10-05 audit)

Lab numbers only (Lighthouse, production builds, localhost): desktop scores 100; mobile LCP is 2.5-3.6 s on four of
five routes. Do these in order, and re-run the same Lighthouse routes after each to confirm the numbers moved.

- [ ] **1. Admin CORS preflight on every call.** `X-Auth-Mode` is sent on all requests and the API sets no
  `Access-Control-Max-Age`, so each call costs an extra round trip. Send the header only on login and set `maxAge`
  (for example 600) in `apps/api/src/app.ts`. Small.
- [ ] **2. Load form code only where it is used (web-app).** The 102 KB gz chunk (zod + react-hook-form) loads on every
  page; 83 of 97 KB are unused on the dashboard. Load the new-project, new-task and password dialogs with
  `next/dynamic`. Afterwards measure whether `zod/mini` is worth it.
- [ ] **3. Split the admin panel's routes.** One 221 KB gz chunk, 127 KB unused on `/users`. Use `React.lazy` per
  route and `manualChunks` for vendor libraries (so they keep a stable hash).
- [ ] **4. Stop the admin's "who am I?" waterfall.** `RequireAuth` waits for `/auth/me` before the page's own
  requests start. Start them in parallel, or render the shell while `/me` loads.
- [ ] **5. Limit the sidebar fetch.** Every web-app page calls `GET /api/projects?pageSize=100` (3 SQL queries) to
  show 3 projects (`apps/web-app/components/sidebar.tsx`). Ask for the 3 most recent, or cache per user.
- [ ] **6. RUM and error tracking.** None today, so field p75 LCP/INP/CLS are unknown. Add `web-vitals` (attribution
  build) via `sendBeacon`, an error tracker (boundaries, global handlers), per-route and connection dimensions,
  release markers, alerts and an owner.
- [ ] **7. Performance budgets in CI.** A per-chunk size budget and Lighthouse CI, each checked to actually fail
  when exceeded.
- [ ] **Measure INP and long tasks.** Not measured in the audit. Take a CPU-throttled trace of the command palette,
  the project board and the admin tables once there is realistic data.
- [ ] **Test with realistic data.** The seed has a handful of rows. Check the 100-item lists, pagination, and the
  sidebar fetch with hundreds of projects.
- [ ] **Confirm compression and caching on the real host.** `vite preview` does not compress and Next only gzips.
  Brotli, HTTP/2 and CDN caching are decided by hosting.
- [ ] **Login and app pages are not CDN-cacheable.** The per-request CSP nonce makes them dynamic
  (`Cache-Control: private, no-store`). A known trade-off; revisit only if field TTFB is a problem.
- [ ] **Minor.** Render-blocking CSS (~11 KB gz, 60-300 ms estimated); 14 KiB of legacy JavaScript (check the
  browserslist target); i18n resources embedded in each page (~27 KB raw on login); delete the unused template SVGs
  in `apps/web-app/public` and `apps/marketing-app/public`; add hover prefetch for common navigations.

## Product gaps

- [ ] **Privacy and Terms pages are placeholder text** and need legal review.
- [ ] **Contact messages have no admin screen.** The marketing contact form stores to `contact_messages`, but no one
  can read them in the admin panel yet.
- [ ] **No billing.** Plans are changed by platform admins only; there is no payment integration behind the
  `billing_charge` audit event.
- [ ] **docs site and ui-native** were explicitly left out of scope and have not been built.

## Quality and tooling

- [ ] **End-to-end tests.** Flows were checked by hand in the browser, but there is no automated browser test suite
  (Playwright) and no visual-regression testing for the Storybook stories.
- [ ] **Lint the API.** `apps/api` and `packages/auth` have type-checks and tests but no ESLint config.
- [ ] **Embedded dev database is fragile on Windows.** Force-killing it once corrupted `.pgdata` (missing
  `PG_VERSION`). Make `db:embedded` detect a half-initialised directory and offer to recreate it.
- [ ] **Dependabot.** `.github/dependabot.yml` exists but has never opened a PR; check the first run.

## Done (for reference)

Phase 1 deployment (admin served by the API, API bundled for production, Dockerfile, Compose stack, smoke test, CI rehearsal and publish jobs; also fixed the missing theme generation that broke fresh builds); real Postgres backend with tenancy and admin rules; mock API removed; richer seed; reset-password page; sessions
revoked on sign-out; Next 16.3.6; per-endpoint rate limiting in Postgres; CSP (report-only), browser headers and
BFF origin check; CI workflow; cookie sessions for the admin panel; change password and the device list;
`@trestle/auth` shared package; shared `INTERNAL_API_KEY` for per-visitor limits.
