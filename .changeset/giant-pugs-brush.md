---
"@trestle/design-tokens": minor
---

Initial release of the design tokens package:

- W3C token source (primitives plus semantic light and dark) with alias resolution
- Real brand palette (purple action color, feedback colors, categorical accents), Manrope, a 5xl size, and line-height and z-index scales
- Generator that emits semantic colors as full hex CSS variables for :root and .dark
- Tailwind preset exposing the tokens as utilities
- `fontFamily.sans` emits `var(--font-sans, Manrope), system-ui, sans-serif` instead of a literal family name, so an app loading the font via `next/font`'s `variable` option (which only exposes it through a CSS variable) actually picks it up, while still falling back to the raw token value when no such variable is set
