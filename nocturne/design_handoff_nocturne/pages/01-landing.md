# Landing Page

- **Design reference:** `reference/source/Nocturne Landing.dc.html`
- **Target route:** `src/app/page.tsx` (the `(marketing)` root) + `src/components/landing/*`
- **Status:** Partially built already — `globals.css` contains landing-specific styles
  (`[data-reveal]`, `[data-feat]`, `[data-shine]`, `[data-marquee]`, `noct-*` keyframes) and
  `src/components/landing/` already has hero, problem, how-it-works, features, compare, privacy,
  pricing, demo, faq, newsletter, footer, nav sections. **Reconcile these existing components
  against the mock — the mock is ground truth where they differ.**

## Purpose
Convert a prospective student: explain the "study what's likely on the exam" value prop, prove
the privacy story, show the product, and drive to Sign Up.

## Layout (top → bottom, single scroll)
1. **Top nav** — sticky. Wordmark left; center nav links (`[data-navlink]` underline-on-hover);
   right = "Sign in" ghost link + "Get started" primary (`rounded-btn` 6px, `[data-shine]`).
2. **Hero** — `h1` `clamp(40px,7vw,72px)`, weight 600, tracking -0.025em. Line 2 uses the
   tagline text-gradient (`#A5B4FC→#A78BFA→#FB7185`). Sub-paragraph `text-secondary`. Primary +
   secondary CTA. Reveal-on-scroll via `[data-reveal]` with `data-delay`.
3. **Fields marquee** — horizontally scrolling row of subjects (`[data-marquee]`, pauses on hover).
4. **Problem / How-it-works / Features** — feature cards use `[data-feat]` (radial cursor-follow
   glow, glyph lift on hover). Red-zone feature variant uses `[data-feat-red]`.
5. **Compare section** — 2-col table (collapses to 1 col under 760px via `[data-cards-3]`).
6. **Privacy section** — `[data-privacy-grid]`, the encryption story.
7. **Interactive demo** — scan-sweep animation (`noct-sweep`, `noct-scanfield`).
8. **Pricing** — tiers (mirror the Vault Dashboard billing tiers for consistency).
9. **FAQ** — accordion (reuse shadcn `accordion`).
10. **Newsletter + Footer** — `[data-footer-grid]` (2-col under 760px).

## Tokens
Marketing-zone radii (6–8px), `--text-*` display sizes, tagline gradient, reveal animation.
All already present in `globals.css`.

## Interactions
Scroll-reveal, hover glows, marquee pause, smooth-scroll anchors (`#privacy`, `#top`). All the
CSS hooks already exist — wire the React components to emit the same `data-*` attributes.

## Responsive
Breakpoints already defined in `globals.css`: `880px` (hide desktop nav), `760px` (stack grids).

## Note
Because this page is the furthest along in code, the main task here is **reconciliation, not
rebuild** — diff each `landing/*` component against the mock and fix drift (spacing, copy,
radii, gradient stops).
