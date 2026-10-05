---
"@trestle/api-client": minor
---

Add `auth.resetPassword` and its schema, validation schemas for updating projects and tasks (and `color`, `status` and `assigneeId` on creation), and drop `progress` from `UpdateProjectInput`: a project's progress is now derived from its tasks.

Also removes the React hooks nothing used (`useDashboard`, `useProjects`, `useProject`, `useTasks`, `useDeleteProject`, `useDeleteTask`); the query option factories behind them are unchanged.

In the browser the schemas now run zod's interpreted path instead of compiling with `new Function`, so a strict Content-Security-Policy does not report them. The server still compiles.

Also: `auth.changePassword`, `auth.sessions.list/revoke/revokeOthers` with `useChangePassword`, `useSessions`, `useRevokeSession`, `useRevokeOtherSessions` and `useLogout`; `LoginResult.token` is `string | null`, null when the client asked for a cookie session; the axios transport gains `cookieSession` (credentials plus `X-Auth-Mode: cookie`) and the fetch transport gains `getHeaders`.
