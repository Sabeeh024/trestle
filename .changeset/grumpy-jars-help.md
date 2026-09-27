---
"@trestle/ui": minor
---

Add shared component library: Button, Badge, Card, Logo, Input, Select, Checkbox, Avatar, Table, Breadcrumb, Dropdown Menu, Dialog, Alert Dialog, SidePanel, PropertyList and NavItem, wired to the design tokens.

`styles/globals.css` is split into a reusable `styles/tokens.css` (the shadcn-to-token variable mapping) and a thin entry file, so a consuming app imports the mapping once through its own Tailwind pipeline instead of duplicating it.
