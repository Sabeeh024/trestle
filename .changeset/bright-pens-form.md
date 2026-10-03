---
"@trestle/forms": minor
---

Initial release of the shared form helpers, built on react-hook-form and zod:

- `useZodForm(schema)`, a react-hook-form instance that validates against a zod schema on blur and then on every change
- `submitForm(form, action)`, a submit handler that validates, runs the action, and puts any API failure back on the form instead of leaving an unhandled rejection
- `applyApiError`, which maps a server validation failure (HTTP 422) onto the matching fields and sends anything else, including fields the form does not have, to a form-level error
- `fieldError`, `rootError` and `messageFor`, which translate the validation message keys into the app's language and pass plain server messages through
