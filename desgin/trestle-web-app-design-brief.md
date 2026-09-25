# Design Brief: Trestle — Web App

**Product:** Trestle — project/task management tool (Linear/Notion/Asana-style)
**Scope:** `apps/web-app` — the core authenticated product surface (not marketing site or docs site)
**Context:** Part of a learning-focused monorepo project. Priority is buildable, standards-based UI over novel design exploration.

---

## 1. Design System Constraints (must follow)

- Built with **Tailwind CSS + shadcn/ui components** (Radix UI primitives underneath)
- All colors, spacing, radius, and typography must map to the **CSS variable–based semantic tokens** already defined in `packages/design-tokens`. Do not invent new raw color values — use semantic names:
  - `background`, `background-subtle`, `background-muted`
  - `text-primary`, `text-secondary`, `text-disabled`, `text-inverse`
  - `border`, `border-strong`
  - `action-primary`, `action-primary-hover`, `action-primary-text`
  - `feedback-success`, `feedback-success-bg`, `feedback-warning`, `feedback-warning-bg`, `feedback-danger`, `feedback-danger-bg`
- Must support **light and dark mode** via a `.dark` class on `<html>`. Every screen must be designed with both states in mind, not light mode with dark mode as an afterthought.
- **Spacing scale (4px-based):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px — no arbitrary spacing values.
- **Typography scale:** 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36px — no custom font sizes outside this scale.
- **Border radius scale:** none / sm (4px) / md (8px) / lg (12px) / xl (16px) / full — reuse, don't invent new radii.

## 2. Responsive Requirements

- Mobile-first responsive design.
- **Breakpoints:** sm 640px / md 768px / lg 1024px / xl 1280px / 2xl 1536px
- Fully usable down to ~375px width, even though this product category is primarily desktop-first.
  - Sidebar/nav must collapse appropriately on small screens.
  - Tables/boards must degrade gracefully (horizontal scroll or card view on mobile).
- Test critical flows (task creation, project view) at mobile, tablet, and desktop widths.

## 3. Industry-Standard Patterns to Follow

Reference the interaction and layout patterns of **Linear**, **Notion**, and **Asana** — familiar, low-friction UX over novel invention. Specifically:

**From Linear**
- Command palette (`Cmd+K`) as primary power-user navigation — search, create task, switch project
- Minimal, dense sidebar — icon + label list, collapsible, workspace switcher at top
- Keyboard shortcuts throughout (`C` to create, `/` to search, arrow keys to navigate)
- Status/priority shown as small colored dots or badges — restrained, not heavy UI
- Fast, optimistic UI updates (task moves instantly, syncs in background)

**From Notion**
- Nested sidebar structure — projects can contain sub-items, collapsible tree
- Simple, friendly empty states — short text + clear call-to-action

**From Asana**
- Kanban board + list view toggle on the same underlying data
- Task detail opens as a **right-side panel**, not a full page navigation — keeps board context visible while editing

**General standards**
- Standard app shell: persistent left sidebar (collapsible) + top bar (breadcrumb, search, user menu) + main content area
- Empty states, loading states (skeletons preferred over spinners), and error states must be designed for every view, not just the happy path
- Forms follow standard patterns: inline validation, clear required-field indication, disabled state using the `text-disabled` token

## 4. Screens Needed (v1 scope)

1. Login / auth screen (simple — backend is mocked)
2. Dashboard / home — overview of recent projects, assigned tasks
3. Project list view
4. Single project view — kanban board + list view toggle
5. Task detail — side panel with comments, assignee, due date, status
6. Settings — profile, theme toggle

## 5. Component Inventory (feeds `packages/ui`)

Button (primary / secondary / ghost / destructive variants), Input, Select, Avatar, Badge (status/priority), Card, Modal/Dialog, Dropdown Menu, Tabs, Table, Toast/notification, Sidebar nav item, Command palette, Skeleton loader

## 6. Deliverable Format

For each screen, describe:
- Layout structure (what's in the sidebar, what's in the top bar, content hierarchy) — not just visuals
- Which shadcn components map to which UI element, so the design translates directly into buildable component code

## 7. Explicitly Avoid

- Novel/experimental navigation patterns — this is a learning project about monorepo architecture, not UX innovation
- Custom illustrations, heavy animation, or assets beyond what's achievable with Tailwind + Lucide icons
- Any component pattern not achievable with Radix primitives (no canvas-based or exotic interactions)
