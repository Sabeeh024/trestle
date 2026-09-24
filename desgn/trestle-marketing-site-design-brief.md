# Design Brief: Trestle — Marketing Site

**Product:** Trestle — public marketing/landing site for the Trestle project management tool
**Scope:** `apps/marketing-site` — public-facing, unauthenticated, SEO/conversion focused (not the product app itself)
**Context:** Part of a learning-focused monorepo project. Priority is a credible, standards-based SaaS marketing site over novel design exploration.

---

## 1. Design System Constraints (must follow)

- Built with **Tailwind CSS + shadcn/ui components** (Radix UI primitives underneath)
- All colors, spacing, radius, and typography must map to the **CSS variable–based semantic tokens** already defined in `packages/design-tokens`. Do not invent new raw color values — use semantic names:
  - `background`, `background-subtle`, `background-muted`
  - `text-primary`, `text-secondary`, `text-disabled`, `text-inverse`
  - `border`, `border-strong`
  - `action-primary`, `action-primary-hover`, `action-primary-text`
  - `feedback-success`, `feedback-success-bg`, `feedback-warning`, `feedback-warning-bg`, `feedback-danger`, `feedback-danger-bg`
- Must support **light and dark mode** via a `.dark` class on `<html>`.
- **Spacing scale (4px-based):** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px — no arbitrary spacing values.
- **Typography scale:** 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36px — no custom font sizes outside this scale. (Hero/display text may need a larger size added to the scale — flag it rather than inventing an arbitrary one-off value.)
- **Border radius scale:** none / sm (4px) / md (8px) / lg (12px) / xl (16px) / full — reuse, don't invent new radii.
- Reuse the **same design tokens as the core web app** (`apps/web-app`) — the marketing site must feel like it belongs to the same product, not a re-skinned or off-brand experience.

## 2. Responsive Requirements

- Mobile-first responsive design.
- **Breakpoints:** sm 640px / md 768px / lg 1024px / xl 1280px / 2xl 1536px
- This is a public site — mobile traffic is significant, so mobile layout is not an afterthought. Every section must be designed mobile-first, then enhanced for larger screens.
- Hero sections, pricing tables, and feature grids must reflow cleanly at all breakpoints (e.g. pricing table → stacked cards on mobile, side-by-side on desktop).

## 3. Industry-Standard Patterns to Follow

Reference the marketing sites of **Linear, Notion, Vercel, and Stripe** — clean, conversion-focused SaaS marketing patterns, not novel layout experimentation.

**Standard structure**
- Sticky top nav: logo, nav links, "Log in" + primary CTA button ("Get started" / "Sign up")
- Hero section: headline, subheadline, primary CTA, optional product screenshot/mockup
- Social proof strip (logos or stats) — can use placeholder content
- Feature sections — alternating text/visual layout, 3-4 key features max, each tied to a real product capability (tasks, projects, boards, collaboration)
- Comparison or "why Trestle" section — short, scannable
- Pricing section (can be simple tiered cards — Free / Pro / Enterprise placeholder tiers)
- FAQ section (accordion component)
- Final CTA section before footer
- Footer: nav links, social links, legal links, copyright

**General standards**
- Fast-feeling, minimal animation — subtle fade/slide-in on scroll is acceptable, nothing heavy
- Clear visual hierarchy — one primary CTA per section, no competing calls to action
- Generous whitespace, confident typography — this is a brand-forward page, more visual breathing room than the dense product app
- Accessible contrast in both light and dark mode

## 4. Pages Needed (v1 scope)

1. Home / landing page (primary focus — the sections above)
2. Pricing page (can reuse pricing section from home, expanded with more detail/comparison table)
3. 404 page (simple, on-brand)

## 5. Component Inventory (may extend `packages/ui`)

Navbar (sticky, responsive with mobile menu), Button (primary/secondary/ghost variants — already in `packages/ui`), Card (feature card variant), Pricing card, Accordion (FAQ), Badge ("Popular" pricing tag), Footer, Logo cloud/marquee (social proof), Stat display

Reuse existing `packages/ui` components wherever possible (Button, Card, Badge) rather than creating marketing-only duplicates — only add new components (Navbar, Footer, Pricing card, Accordion, Logo cloud) that don't already exist for the product app.

## 6. Deliverable Format

For each page/section, describe:
- Layout structure and content hierarchy — not just visuals
- Which shadcn/existing `packages/ui` components map to which element, and which new components would need to be built
- Copy can be placeholder/lorem-ipsum-adjacent but should reflect Trestle's actual positioning (project management tool) rather than generic filler

## 7. Explicitly Avoid

- Novel/experimental layout patterns — this is a learning project, prioritize a credible, recognizable SaaS marketing pattern
- Heavy custom illustration, 3D graphics, or video — stick to what's achievable with Tailwind, Lucide icons, and simple mockup placeholders
- Inconsistency with the core product app's visual identity — this must feel like the front door to `apps/web-app`, not a separately branded site
