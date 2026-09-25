# Design Brief: Trestle — Docs Site

**Product:** Trestle — public documentation site
**Scope:** `apps/docs-site` — public-facing, unauthenticated, MDX-based documentation (not the product app or marketing site)
**Context:** Part of a learning-focused monorepo project. Priority is readability and navigability over visual flair.

---

## 1. Design System Constraints (must follow)

- Built with **Tailwind CSS + shadcn/ui components** (Radix UI primitives underneath)
- All colors, spacing, radius, and typography must map to the **CSS variable–based semantic tokens** in `packages/design-tokens`. Use semantic names only:
  - `background`, `background-subtle`, `background-muted`
  - `text-primary`, `text-secondary`, `text-disabled`, `text-inverse`
  - `border`, `border-strong`
  - `action-primary`, `action-primary-hover`, `action-primary-text`
  - `feedback-success`, `feedback-success-bg`, `feedback-warning`, `feedback-warning-bg`, `feedback-danger`, `feedback-danger-bg`
- Must support **light and dark mode** via a `.dark` class on `<html>` — documentation is read by developers, who disproportionately prefer dark mode; both must look equally polished.
- **Spacing scale (4px-based):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px.
- **Typography scale:** 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36px. Body text should default to a comfortable reading size (16px base) with generous line height for long-form content.
- **Border radius scale:** none / sm / md / lg / xl / full — reuse, don't invent new radii.
- Reuse the same tokens as `apps/web-app` — the docs site should feel like the same product's documentation, not a separately branded microsite.

## 2. Responsive Requirements

- Mobile-first responsive design.
- **Breakpoints:** sm 640px / md 768px / lg 1024px / xl 1280px / 2xl 1536px
- Three-column desktop layout (nav / content / on-page TOC) must collapse sensibly:
  - Below `lg`: on-page TOC collapses into a dropdown or moves above content
  - Below `md`: left nav becomes a slide-out/hamburger menu
- Code blocks must scroll horizontally on narrow screens rather than wrapping or breaking layout.

## 3. Industry-Standard Patterns to Follow

Reference **Stripe Docs, Vercel/Next.js Docs, and Linear's public docs** — the standard technical documentation pattern, not novel layout experimentation.

**Standard structure**
- Top bar: logo, search (with `Cmd+K` shortcut), version selector (optional), link back to main app/product, GitHub link (if applicable)
- Left sidebar: collapsible nested navigation tree (sections → pages), current page highlighted
- Main content: MDX-rendered article — headings, body text, code blocks, callouts/admonitions (info/warning/tip), tables, inline code
- Right rail (desktop only): on-page table of contents ("On this page"), auto-generated from headings, scroll-spy highlighting current section
- Prev/Next page navigation at the bottom of each article
- Footer: minimal — links back to main site, GitHub, support

**Content components needed**
- Code block with syntax highlighting and a copy button
- Callout/admonition component (info, warning, tip, danger variants — map to feedback tokens)
- Table (for API references, prop tables)
- Inline `code` styling
- Search dialog (command palette pattern, matches the `Cmd+K` pattern from the web app)
- Breadcrumb (for nested doc sections)

## 4. Pages Needed (v1 scope)

1. Docs home / landing (overview, links into getting-started)
2. A representative content page (e.g. "Getting Started") showing the full three-column layout with real-looking body content, a code block, and a callout
3. Search results / command palette state

## 5. Component Inventory (may extend `packages/ui`)

Sidebar nav tree (nested, collapsible), TOC/on-page nav, Code block (with copy button), Callout/admonition, Breadcrumb, Search dialog, Prev/Next nav, Table (docs variant)

Reuse existing `packages/ui` primitives (Button, Badge, Input) where possible; only add documentation-specific components that don't already exist.

## 6. Deliverable Format

For each page, describe:
- Layout structure and content hierarchy — not just visuals
- Which shadcn/existing `packages/ui` components map to which element, and which new components need to be built
- Show realistic-looking placeholder content (real-sounding headings/paragraphs, a plausible code snippet) rather than lorem ipsum, since documentation readability is the whole point of this app

## 7. Explicitly Avoid

- Novel/experimental layout patterns — developers expect the standard three-column docs pattern; deviating hurts usability
- Heavy illustration, animation, or marketing-style visual flourishes — this is a utility surface, not a conversion page
- Inconsistency with the core product app's visual identity (same tokens, same fonts, same spacing)
