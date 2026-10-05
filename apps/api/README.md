# api

The Trestle backend: Hono on Node, PostgreSQL through Drizzle ORM. It implements the contract in
`@trestle/api-client` and listens on port 4000, which is where the apps look by default (`API_URL` for the
Next apps, `VITE_API_URL` for the admin panel).

## Run it

From the repository root:

```bash
pnpm db:embedded      # a real PostgreSQL, no Docker needed (or: docker compose up -d db)
pnpm db:setup         # create the tables, then load the demo data
pnpm dev              # api :4000, web-app :3000, marketing-app :3001, admin-panel :5173
```

**Migrations vs. seed data.** A migration (`drizzle/*.sql`) changes the *structure* of the database: tables,
indexes, extensions. It runs everywhere, including production, and each file runs once. Seed data
(`src/db/seed.ts`) is the *demo content* that fills those tables so the apps have something to show. It is
for development only and refuses to run in production. `db:migrate` applies migrations, `db:seed` loads the
demo data into an empty database, and `db:reset` wipes everything and reloads it. Configuration is in `.env.example`.

Every seeded account's password is `trestle-dev-1`:

| Account | Role | What they see |
| --- | --- | --- |
| `jordan.kim@trestle.io` | owner, platform organization | Trestle's workspace, and every organization in the admin panel |
| `jamie.singh@trestle.io` | member | the same Trestle workspace, no admin access |
| `alex.kim@northwind.io` | admin | Northwind's workspace; only Northwind in the admin panel |
| `elena.cho@northwind.io` | member | Northwind's workspace |
| `maya@fontaineco.com` | member | Fontaine Co.'s workspace |
| `priya@verity.app` | admin | Verity's workspace; only Verity in the admin panel |
| `tom.baker@haldane.co` | member | suspended, cannot sign in |
| `sam.r@umbralabs.dev`, `noah@fontaineco.com` | invited | no password yet: use "forgot password" or an admin's reset |

## Design

- **Tenancy.** Users belong to an organization; projects (and so tasks) belong to the organization of the
  person who created them, and every product query is filtered by the caller's organization. A resource in
  another organization is a 404, never a 403.
- **Admin scope.** Admin endpoints need role owner or admin. Admins of the platform organization
  (`organizations.is_platform`) see all organizations; every other organization's admins see only their own,
  cannot create organizations or change plans. Only owners can change owners, you cannot act on yourself, and
  an organization always keeps one active owner. Viewers are read-only.
- **Auth.** Passwords are scrypt-hashed. A login issues an opaque random token; only its SHA-256 is stored
  (`sessions`), so logout, suspension and password resets revoke access immediately. Login is throttled per
  client and address, and unknown emails cost the same time as wrong passwords. Invitations and resets are
  single-use emailed links (`password_resets`); the mailer is pluggable (`lib/mailer.ts`, console by default).
- **Sessions.** Two ways to hold one. A server that keeps the token itself (the Next apps) gets it in the login
  response and sends `Authorization: Bearer`. A browser app with no server of its own (the admin panel) sends
  `X-Auth-Mode: cookie` and gets an `HttpOnly`, `SameSite=Lax` cookie (`__Host-` prefixed and `Secure` in
  production) instead, so page scripts never see the token. A cookie is sent automatically, so a write that
  arrives by cookie must come from one of `CORS_ORIGINS`; the admin panel and API therefore need to be on the same
  site (for example `admin.example.com` and `api.example.com`). People can change their password (which signs out
  every other device), list where they are signed in, and sign devices out.
- **Rate limiting.** Counters live in Postgres (`rate_limits`), so every instance shares them and a restart keeps
  them. Sign-in is limited per client+account, per client and per account; sign-up, forgot-password (counted for
  unknown addresses too), reset-password, contact, invitations and CSP reports have limits of their own
  (`src/lib/rate-limit.ts`). The client address is the socket's unless `TRUST_PROXY` says how many proxies sit in
  front, because `X-Forwarded-For` is otherwise whatever the caller wrote. The web apps' servers call the API on
behalf of every visitor, so they present the shared `INTERNAL_API_KEY` and say which visitor a request is for
(`X-Client-IP`); without it the API would see one address for everyone.
- **Headers.** Every response carries `nosniff`, a deny-all CSP, `no-referrer` and HSTS, and everything under
  `/api` is `Cache-Control: private, no-store`.
- **SSO** needs an identity provider and is not wired up: the endpoint answers 501 for enterprise users
  (`DEV_SSO=1` re-enables the old "any enterprise user" shortcut for local work and is refused in production).
- **Queries.** Lists are one query for the page (with `count(*) over()` for the total), one for the members
  of those rows and one for task counts, whatever the page size. Project progress is derived from tasks, never
  stored. Search is `ILIKE '%term%'` backed by `pg_trgm` GIN indexes; sorts and filters have matching
  composite or partial indexes (`src/db/schema.ts`), and `src/perf.test.ts` checks the plans use them.
- **Errors** follow the contract: `{ error: { code, message, fields? } }`, with validation failures as 422 and
  per-field message keys that the apps translate.

## Tests

```bash
pnpm --filter api test                                   # in-process Postgres (PGlite), nothing to install
TEST_DATABASE_URL=postgres://trestle:trestle@localhost:5432/trestle pnpm --filter api test   # a real server
```

Both run the real migrations. The second creates a throwaway database per test file.

## Migrations

Edit `src/db/schema.ts`, then `pnpm --filter api db:generate` and commit the new file in `drizzle/`.
`db:migrate` applies them. `0000_extensions.sql` enables `pg_trgm`, which needs a role that may create
extensions (the default on managed Postgres).
