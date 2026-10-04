---
"@trestle/api-client": minor
---

Initial release of the shared API client, with the HTTP library behind a pluggable transport:

- `createApi(transport)`, typed endpoint functions for auth, the dashboard, projects, tasks and comments, and the admin users, organizations and audit log, with request and response types exported from `@trestle/api-client/types`
- `@trestle/api-client/fetch`: `createFetchTransport`, built on native `fetch`, for Next.js. It passes `next` (`revalidate`, `tags`) and `cache` options through per request, so Server Components keep Next's caching and revalidation. It sends no abort signal and no timeout by default, because a signal switches off Next's request memoization; set `timeoutMs` to opt in
- `@trestle/api-client/axios`: `createAxiosTransport`, for the Vite SPA and React Native, with the underlying instance exposed for extra interceptors
- Both transports attach the bearer token, reject with a typed `ApiError` (`code`, `status`), call `onUnauthorized` on 401, and report network failures and timeouts distinctly; a caller's own abort is passed through untouched
- `@trestle/api-client/query`: hierarchical query keys, React Query option factories that serve both `useQuery` and server-side `prefetchQuery`, and `getQueryClient`, which is per-request on the server and shared in the browser
- `@trestle/api-client/react`: `ApiProvider` and ready-made query and mutation hooks that invalidate the right queries after writes

- `@trestle/api-client/schemas`: zod request schemas (login, project, task, comment, invite user, change role, organization) shared by the apps and the mock server. Their messages are keys such as `required` and `emailInvalid`, not prose, so each app translates them. `ApiError` carries per-field messages (`fields`) from a validation failure.

`axios`, `@tanstack/react-query` and `react` are optional peer dependencies, so an app installs only what its transport and rendering need.

- Account and edit endpoints: `auth.signup`, `auth.sso`, `auth.forgotPassword` and `auth.updateProfile`, plus `admin.users.update` and `admin.organizations.update`, each with a schema and a React Query hook. Projects gain an `archived` status.
- `contact.send` and a `contactSchema` for the marketing site's contact form
