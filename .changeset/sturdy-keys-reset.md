---
"@trestle/api-client": minor
---

Add `auth.resetPassword` and its schema, validation schemas for updating projects and tasks (and `color`, `status` and `assigneeId` on creation), and drop `progress` from `UpdateProjectInput`: a project's progress is now derived from its tasks.
