---
"@trestle/api-client": minor
---

Initial release of the shared API client:

- `createApiClient`, an axios instance that attaches the bearer token and rejects with a typed `ApiError` (`code`, `status`), with a hook for 401s and distinct network and timeout errors
- `createApi`, typed endpoint functions for auth, the dashboard, projects, tasks and comments, and the admin users, organizations and audit log, with request and response types exported from `@trestle/api-client/types`
- `@trestle/api-client/query`: hierarchical query keys, React Query option factories that work for both `useQuery` and server-side `prefetchQuery`, and `getQueryClient`, which is per-request on the server and shared in the browser
- `@trestle/api-client/react`: `ApiProvider` and ready-made query and mutation hooks that invalidate the right queries after writes
