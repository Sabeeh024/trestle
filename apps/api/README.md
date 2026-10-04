# api

The Trestle backend: Hono on Node, PostgreSQL through Drizzle ORM. It serves the same contract as
`@trestle/mock-api` (see `@trestle/api-client`), so the apps switch over by running this on port 4000
instead of the mock.

## Run it

```bash
docker compose up -d db            # or: pnpm --filter api db:embedded   (no Docker needed)
pnpm --filter api db:migrate
pnpm --filter api db:seed          # demo data; every account's password is trestle-dev-1
pnpm --filter api dev              # http://localhost:4000
```

`pnpm --filter api db:reset` wipes the database and reseeds it. Configuration is in `.env.example`.

Sign in as `jordan.kim@trestle.io` (owner of the platform organization, sees everything in the admin panel)
or `jamie.singh@trestle.io` (member of the same workspace). `alex.kim@northwind.io` is an admin of a
different organization: he sees only Northwind in the admin panel and an empty workspace in the web app.

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
