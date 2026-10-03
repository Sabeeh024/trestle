---
"@trestle/ui": minor
---

Add shared component library: Button, Badge, Card, Logo, Input, Select, Checkbox, Avatar, Table, Breadcrumb, Dropdown Menu, Dialog, Alert Dialog, Label, Textarea, Field, SidePanel, PropertyList and NavItem, wired to the design tokens.

`styles/globals.css` is split into a reusable `styles/tokens.css` (the shadcn-to-token variable mapping) and a thin entry file, so a consuming app imports the mapping once through its own Tailwind pipeline instead of duplicating it.

Adds Storybook (`pnpm --filter @trestle/ui storybook`) documenting every component plus a Design Tokens section (semantic colors, categorical colors, typography scale, spacing scale, border radius) with a light/dark toolbar toggle, so the design system can be browsed and reviewed without wiring up a consuming app.

`Field` ties a label, control, hint and error message together with the right `id`, `aria-invalid` and `aria-describedby`, and `FormError` shows a form-level failure, so a validated form needs no hand-written accessibility wiring.
