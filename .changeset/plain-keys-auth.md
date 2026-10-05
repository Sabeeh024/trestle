---
"@trestle/auth": minor
---

Initial release of the shared auth helpers: the session cookie (name with the `__Host-` prefix in production, options, serialising and reading), the cross-site write check and bearer-token reader, the headers a server sends to the API to say which visitor a request is for, the security-header set every app uses, and a readable name for a browser's user agent.
