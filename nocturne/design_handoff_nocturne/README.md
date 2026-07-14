# Handoff: Nocturne Redesign — Full App

## Overview
This package specs the complete visual redesign of **Nocturne** (a zero-knowledge, privacy-first
study-capture app) across every page, plus two net-new features (**Momentum** and **Community**).
It is built for a developer using Claude Code to implement the designs in the existing
**Next.js 16 / React 19 / Tailwind v4 / shadcn (radix-nova) / Supabase** codebase.

## ⚠️ Ground-truth principle (read first)
The HTML files in `reference/source/` are the **ground truth for visual style**. The codebase
must conform to them — **not the reverse**. Where the current `src/app/globals.css` tokens or an
existing component disagree with a mock, **change the codebase to match the mock**. The very first
Claude Code attempt failed because it was given *compressed/bundled* HTML and inferred its own
values (notably: corners too tight on app surfaces). This package fixes that with clean source,
exact tokens, and an explicit conform-to-the-design instruction.

## About the design files
These are **HTML design references / prototypes**, not production code. Recreate them in the
codebase's real environment (App Router pages, React components, Tailwind tokens, shadcn
primitives, lucide icons, framer-motion). See **`reading-the-references.md`** for how to read the
`.dc.html` format — it's important; read it before opening the source files.

## Fidelity: **High (hifi)**
Final colors, typography, spacing, radii, and interactions. Recreate the UI pixel-faithfully using
the codebase's libraries — exact values are in the mocks and in `DESIGN_SYSTEM.md`.

## What's in this package
| File | What it is |
|---|---|
| **`DESIGN_SYSTEM.md`** | Canonical tokens. **Start here** — includes the exact `globals.css` changes to make. |
| **`reading-the-references.md`** | How to read the `.dc.html` source files. |
| **`components.md`** | Every page mapped onto `src/components/` — keep / modify / new / delete. |
| **`wiring.md`** | Route map, navigation graph, functional hookups, non-breaking rollout order. |
| **`pages/01…10`** | Per-page specs: layout, components, tokens, states, interactions, copy. |
| **`reference/source/`** | Clean `.dc.html` design references + `support.js`. The visual ground truth. |

## Pages (see `pages/`)
1. Landing — `(marketing)` root *(partially built; reconcile)*
2. Login / Sign in — `/login` + `(vault)/unlock`
3. Sign Up — `(vault)/setup` (4-step vault setup)
4. Legal — `(marketing)/{privacy,terms,cookies,security}` (one template, 4 docs)
5. Help Center — `(marketing)/help`
6. Error pages — 404 (`not-found.tsx`) & 500 (`error.tsx`)
7. Vault Dashboard — `(app)/vault` *(+ new ambient momentum ribbon)*
8. Session Workspace — `(workspace)/session` (Lecture / Study / Notes / Ask)
9. **Momentum — `(app)/momentum` (NEW)** — personal-progress hub / gamification
10. **Community — `(app)/community` (NEW)** — material-first course rooms

## Suggested order of work (non-breaking — full detail in `wiring.md`)
1. **Adopt the token changes** in `DESIGN_SYSTEM.md` §0 (restyles everything at once).
2. **Reconcile existing pages** component-by-component against the mocks (landing → vault →
   session → auth → legal → help → errors), behind the current routes so the app keeps working.
3. **Add sidebar Momentum + Community** items and the **Vault ambient ribbon**.
4. **Build `/momentum`** — local-first, shippable with no new infrastructure.
5. **Build `/community`** last — needs backend aggregation (counts-only), `.edu` room
   verification, and thread moderation. Treat those as pre-launch requirements.

## Stack notes
- **`AGENTS.md` matters:** this is Next.js 16 with breaking changes vs. training data — read
  `node_modules/next/dist/docs/` before routing/error/params work.
- Icons: **lucide-react** (mocks hand-draw SVGs — map each to its lucide equivalent; table in
  `DESIGN_SYSTEM.md` §6).
- Animation: **framer-motion** (already used in `side-nav.tsx`; see `src/lib/motion.ts`).
- Styling: Tailwind v4 `@theme` tokens + shadcn variants. The mocks use inline styles only because
  the prototype format requires it — **in code, prefer Tailwind utility classes mapped to the
  tokens**, not inline styles.

## Assets
No raster assets. All iconography is line-SVG → lucide. Fonts: Inter + JetBrains Mono (already
configured). The brand mark is a gradient "N" tile (`linear-gradient(145deg,#6366F1,#8B5CF6)`).

## Screenshots
Not included by default. Ask and they'll be added to `reference/screenshots/`, or open any
`reference/source/*.dc.html` directly in a browser to view it rendered.
