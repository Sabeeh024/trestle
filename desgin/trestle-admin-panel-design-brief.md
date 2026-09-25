# Design Brief: Trestle — Admin Panel

**Product:** Trestle — internal admin tool for managing users, organizations, and platform data
**Scope:** `apps/admin-panel` — internal-only, authenticated with elevated permissions, built as a **Vite SPA** (not Next.js — no SEO/SSR need for an internal tool)
**Context:** Part of a learning-focused monorepo project. Priority is information density and operational efficiency over polish — this is a tool for the Trestle team, not customers.

---

## 1. Design System Constraints (must follow)

- Built with **Tailwind CSS + shadcn/ui components** (Radix UI primitives underneath)
- All colors, spacing, radius, and typography must map to the **CSS variable–based semantic tokens** in `packages/design-tokens`. Use semantic names only:
  - `background`, `background-subtle`, `background-muted`
  - `text-primary`, `text-secondary`, `text-disabled`, `text-inverse`
  - `border`, `border-strong`
  - `action-primary`, `action-primary-hover`, `action-primary-text`
  - `feedback-success`, `feedback-success-bg`, `feedback-warning`, `feedback-warning-bg`, `feedback-danger`, `feedback-danger-bg`
- Must support **light and dark mode** via a `.dark` class on `<html>` — internal tools are used for long stretches at a desk, dark mode matters for eye strain as much as the product app.
- **Spacing scale (4px-based):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px — but lean toward the **tighter end** of this scale throughout (8/12/16px) rather than generous marketing-style spacing. Admin tools prioritize seeing more data at once.
- **Typography scale:** 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36px — body/table text should default smaller (14px) than the product app's 16px, consistent with dense internal tooling conventions.
- **Border radius scale:** none / sm / md / lg / xl / full — prefer smaller radii (sm/md) for a more utilitarian, less "consumer product" feel than the marketing site.
- Reuse the same tokens as `apps/web-app` — same brand, different density.

## 2. Responsive Requirements

- **Desktop-first**, not mobile-first — this is an internal tool used almost exclusively on desktop monitors.
- **Breakpoints:** sm 640px / md 768px / lg 1024px / xl 1280px / 2xl 1536px
- Must remain functional (not necessarily optimized) down to tablet width (`md`/768px) for occasional on-the-go checks — full mobile optimization is out of scope for v1.
- Design should assume wide viewports are the norm — data tables, multi-column layouts, and side-by-side panels are appropriate here in a way they wouldn't be for the customer-facing product.

## 3. Industry-Standard Patterns to Follow

Reference **Retool, Stripe Dashboard (internal views), and Linear's admin/workspace settings** — dense, functional, data-grid-heavy internal tooling patterns.

**Standard structure**
- Top bar: minimal — app name/logo, environment indicator (if relevant, e.g. "Staging"), admin user menu
- Left sidebar: nav grouped by resource type (Users, Organizations, Projects, Billing, Audit Log, Settings) — flatter than the product app's sidebar, less need for nesting
- Main content: **data table–first** — sortable, filterable tables with pagination as the default view for any resource list; detail views open as a side panel or dedicated route, not a modal, since admin data often needs more room
- Bulk actions pattern: checkbox row selection + action bar appearing on selection
- Search/filter bar above tables — filter chips for active filters

**Key differences from the product app's design language**
- Denser row heights, smaller text, more visible borders (data-grid feel, not card feel)
- Fewer decorative elements — no empty-state illustrations needed here, plain text + action link is sufficient
- Status shown via compact colored badges/pills (using feedback tokens) rather than larger visual indicators
- Confirmation dialogs required for destructive actions (delete user, suspend org) — use the `feedback-danger` token clearly

## 4. Pages Needed (v1 scope)

1. Users list — data table (name, email, org, role, status, joined date), with search/filter and a detail side panel
2. Organizations list — data table (name, plan tier, member count, created date), similar pattern to Users
3. Audit log — simple chronological list/table of actions (actor, action, target, timestamp)

## 5. Component Inventory (may extend `packages/ui`)

Data table (sortable columns, pagination, row selection), Filter bar / filter chips, Detail side panel, Status badge (compact variant), Confirmation dialog (destructive action), Bulk action bar, Breadcrumb

Reuse existing `packages/ui` primitives (Button, Badge, Input, Dialog) where possible; the main new component investment here is the **data table**, since it's central to almost every admin screen.

## 6. Deliverable Format

For each page, describe:
- Layout structure and content hierarchy — not just visuals
- Table column structure and what actions are available per row (view, edit, suspend, delete, etc.)
- Which shadcn/existing `packages/ui` components map to which element, and which new components (especially the data table) need to be built

## 7. Explicitly Avoid

- Marketing-style visual polish — this tool should look purpose-built and efficient, not "designed to impress"
- Card-heavy layouts for list data — use tables; cards hide too much information per screen for an admin context
- Novel interaction patterns — admin tool users value speed and predictability over delight
