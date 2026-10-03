---
"@trestle/mock-api": minor
---

Initial release of the mock API server: a Hono app on port 4000 with in-memory seed data, covering auth, dashboard, projects, tasks and comments for the product app, and users, organizations and the audit log for the admin panel. Lists support search, filters and pagination, admin actions write audit entries, and `MOCK_LATENCY_MS` and `MOCK_REQUIRE_AUTH` simulate latency and enforced sign-in. The API contract types live in `@trestle/api-client/types`.

Request bodies are validated with the shared `@trestle/api-client/schemas`, and a failure returns HTTP 422 with `{ error: { code: "validation_failed", fields } }`, so the apps' client-side validation and the server cannot disagree.
