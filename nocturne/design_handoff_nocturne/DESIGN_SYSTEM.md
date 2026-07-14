# Nocturne Design System — Canonical Tokens

> **This is ground truth.** The HTML design references in `reference/source/` define the
> intended look of Nocturne. Where the current codebase (`src/app/globals.css`) disagrees
> with the values below, **update the codebase to match these** — not the reverse.
> This document supersedes the token comments in `globals.css` that point at a missing
> `DESIGN_SYSTEM.md`; this file *is* that document.

The product personality is **premium, focused, privacy-first**: dark, calm, low-chroma
surfaces; a single indigo accent doing the structural work; warmth (amber) and alarm (rose)
used sparingly and only with meaning. Dark mode only. No light theme.

---

## 0. What to change in `globals.css` (summary)

Your `@theme` block is already ~90% correct — colors, text, borders, fonts all match.
The two real drifts to fix:

1. **Surface elevations.** The designs use a finer near-black ladder than the single
   `--color-bg-elevated: #111118` currently defined. Adopt the three-step ladder in §1.1.
2. **Radii.** The designs use *two zones*: tight chrome on marketing/auth/error pages and
   softer corners on app surfaces. Your current `--radius-card: 8px` is right for marketing
   but the app dashboards (Vault, Session, Momentum, Community) use 11–18px. Adopt the full
   scale in §4.

Everything else below is documentation of what already exists — keep it.

---

## 1. Color

### 1.1 Surfaces — adopt this ladder
Layer from darkest (page) to lightest (raised tiles). Steps are deliberately subtle.

| Token (target) | Hex | Replaces / status | Use |
|---|---|---|---|
| `--color-bg-base` | `#09090F` | ✓ unchanged | App background, body |
| `--color-bg-rail` | `#0B0B11` | **new** | Sidebar, deepest nested panels, list rows on cards |
| `--color-bg-card` | `#0C0C13` | **new** (was folded into `#111118`) | Standard card / module background |
| `--color-bg-raised` | `#0D0D14` | **new** | Inputs-on-cards, raised tiles, user row |
| `--color-bg-input` | `#13121C` | ✓ unchanged | Form inputs, inset chips |
| `--color-bg-overlay` | `#16151F` | ✓ unchanged | Progress tracks, hairline fills, hover ground, popovers |
| `--color-bg-subtle` | `#1C1B28` | ✓ unchanged | shadcn muted/secondary surface |

> Practical rule: a card is one step lighter than its parent. Page → rail/card → raised.

### 1.2 Borders (unchanged — already correct)
| Token | Hex | Use |
|---|---|---|
| `--color-border-subtle` | `#191827` (≈`#16151F` in mocks) | Internal dividers, section separators |
| `--color-border-default` | `#1E1E2E` | Default card / input border |
| `--color-border-strong` | `#2D2B45` | Hover/raised border, secondary buttons |

Mocks also use intermediate `#1A1A26` for card borders and `#23222F` for strong button
borders — treat these as within the `subtle→default→strong` band; snap to the nearest token.

### 1.3 Text (unchanged — already correct)
| Token | Hex | Use |
|---|---|---|
| `--color-text-primary` | `#E2E8F0` | Headings, primary values |
| `--color-text-secondary` | `#94A3B8` | Body copy, descriptions, muted labels |
| `--color-text-tertiary` | `#5B6478` | Captions, metadata, counts |
| `--color-text-inverse` | `#09090F` | Text on indigo/amber fills (near-black) |
| *(disabled / axis)* | `#3F485C` | Placeholder text, dashed-state glyphs, chart axes |

`#CBD5E1` appears as a half-step between primary and secondary for de-emphasized values —
optional `--color-text-primary-soft`.

### 1.4 Accent scales (unchanged — already correct)
Indigo is the only structurally-saturated color. Rose / Violet / Amber are semantic.

- **Indigo** 50→900 (`#6366F1` = 500 primary, `#4F46E5` = 600 hover, `#818CF8` = 400 icon,
  `#A5B4FC` = 300 accent-text, `#C7CEF5` ≈ active-nav text).
- **Rose** — Red Zone / exam-critical / destructive (`#FB7185` = 300, `#F43F5E` = 400).
- **Violet** — Likely Zone / synthetic (`#8B5CF6` = 500, `#A78BFA` = 400).
- **Amber** — momentum / streak / reward / warning (`#FBBF24`/`#FCD34D` = 200, `#F59E0B` = 300).
- **Teal/success** — mastered / exam-ready / live — **add if missing**: `#2DD4BF`, `#5EEAD4`.

### 1.5 Brand gradient & washes
- **Brand:** `linear-gradient(145deg, #6366F1, #8B5CF6)` — logo tile, avatars, "studied" chips.
- **Tagline text gradient (marketing):** `linear-gradient(100deg,#A5B4FC 0%,#A78BFA 45%,#FB7185 100%)` with `background-clip:text`.
- **Momentum hero wash:** `linear-gradient(120deg, rgba(251,191,36,0.10) 0%, rgba(244,63,94,0.05) 38%, rgba(13,13,20,0.4) 100%)`.
- **Accent panel wash:** `linear-gradient(120deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.03) 45%, transparent 100%)`.
- **Ambient page glow:** one `radial-gradient(720px 300px at 26% -90px, <tint>, transparent)` per page, behind content, `pointer-events:none`.

### 1.6 Tinting recipe (every accent/semantic color)
- Background fill: `rgba(<base>, 0.05–0.14)`
- Border: `rgba(<base>, 0.22–0.40)`
- Icon / text: full color (or its lighter text variant)
- "Earned/active/selected" surfaces sit ~`0.05–0.13` tint bg; idle = plain rail surface.

rgba bases: indigo `99,102,241` · rose `244,63,94` · violet `139,92,246` · amber `251,191,36` · teal `45,212,191`.

---

## 2. Typography

- **UI font:** Inter (400/500/600/700), `--font-sans`.
- **Mono:** JetBrains Mono (400/500), `--font-mono` — counts, balances, ratios (`12 / 14`),
  course codes, ranks, uppercase eyebrows, axis labels.
- Base body: `14px / 1.6`, `#E2E8F0`, antialiased (already set in `globals.css`).

**Type scale** (extend the `--text-*` tokens to cover the display sizes the designs use):

| Role | Size | Weight | Tracking | Token |
|---|---|---|---|---|
| Hero (landing) | clamp(40px,7vw,72px) | 600 | -0.025em | — (marketing only) |
| Display | 46px (streak) / 28–34px | 600 | -0.02 to -0.03em | `--text-display` (was 28px) |
| Page H1 | 27px | 600 | -0.025em | `--text-heading-lg` (**new**) |
| Section H2 | 20–24px | 600 | -0.02em | `--text-heading` (20px ✓) |
| Card title | 17–19px | 600 | -0.015em | `--text-subheading` (16px → allow 17–19) |
| Section heading | 15px | 600 | normal | `--text-body` (14px) +1 |
| Body | 14px | 400 | normal | `--text-body` ✓ |
| Body small | 13px | 400–500 | normal | `--text-body-sm` ✓ |
| Label | 12px | 500 | normal | `--text-label` ✓ |
| Caption | 11px | 400–500 | normal | `--text-caption` ✓ |
| Eyebrow | 10.5–11px | 500–600 | +0.04–0.08em UPPERCASE mono | `--text-mono-sm` |

**Rules:** headings are `600`, never `700`; always negative tracking. Nothing below `11px`
except uppercase mono eyebrows (`10.5px`). Mono for anything tabular/numeric.

---

## 3. Spacing

Base unit **4px**. Soft scale: `3 4 6 7 8 9 10 11 12 14 16 18 20 22 24 26 28 34 40`.

- **Card padding:** `20px 22px` (app modules) · `13–17px` (compact tiles) · `26px 28px` (hero bands).
- **Page (app) padding:** `34px 40px 90px`, content `max-width:1080px`, centered.
- **Page (marketing/doc) padding:** `46px 44px 84px`, content `max-width:720–768px`.
- **Module vertical rhythm:** `16px`. Card grid gaps: `13–16px`.
- **Inline gaps:** icon↔label `7–11px`; tight pairs `6–8px`; groupings `14–18px`.
- Always lay rows/groups out with flex/grid + `gap` — never sibling margins.

---

## 4. Radius — adopt full scale

Two zones, both present in the designs and both ground truth:

| Token | Value | Zone / use |
|---|---|---|
| `--radius-input` | `2px` | Text inputs (marketing/legal forms) — ✓ exists |
| `--radius-btn` | `6px` | Marketing buttons, nav pills — ✓ exists |
| `--radius-sm` | `7–8px` | Brand tile, chips, code badges, marketing card/button |
| `--radius-card` | `8px` | Marketing/doc cards — ✓ exists (keep for marketing) |
| `--radius-md` | `9–10px` | App buttons, nav items, inputs, list rows, error-page buttons |
| `--radius-lg` | `11–12px` | App tiles, inner cards, small panels, modal — `--radius-modal:12px` ✓ |
| `--radius-xl` | `14px` | Standard app cards, room sub-panels |
| `--radius-2xl` | `16px` | Primary app modules (Momentum/Community/Vault cards) |
| `--radius-3xl` | `18px` | Hero bands, top-level room panel |
| `--radius-pill` | `9999px` | Tags, badges, toggles, progress tracks, avatars |

> The single most visible fidelity bug in the first Claude Code attempt was **corners too
> tight on app surfaces** — it snapped everything to `--radius-card:8px`. App modules are
> 14–18px. Marketing/auth/error chrome stays 6–10px.

---

## 5. Elevation

Depth = surface lightness + 1px hairline border. **No drop shadows by default.**
- Cards: `1px solid` border + one-step-lighter surface. No shadow.
- Colored glow only on intentionally "live" accents: amber day-chip `0 2px 8px rgba(251,191,36,0.3)`; live status dot `0 0 7px <color>`; Red Zone pulse `0 0 9px→20px rgba(244,63,94,…)`.
- Existing shadow tokens (`--shadow-sm/md/lg`) are for overlays/modals/popovers only.
- One ambient radial glow per page is the only atmospheric effect.

---

## 6. Iconography

- **lucide-react** in code (the mocks hand-draw inline SVGs at 1.5 stroke; map each to its
  lucide equivalent). Render `13–17px` (nav 17, inline meta 13–14), `strokeWidth={1.5}`.
- Icons inherit `currentColor`.
- **Icon-chip pattern:** ~30px square, `rounded-md`, bg `rgba(<color>,0.12)`, border `rgba(<color>,0.26)`, icon full `<color>`.
- No emoji. Line icons only — no filled/duotone sets.

Common mock-glyph → lucide map: vault→`LayoutDashboard`/`Vault`, momentum/streak→`Flame`/`Zap`,
community→`Users`, new→`Plus`, help→`CircleHelp`, billing→`CreditCard`, settings→`Settings`,
Red Zone shield→`ShieldAlert`, mastered→`CircleCheck`, search→`Search`, lock→`Lock`,
thread→`MessageSquare`, deck→`Layers`, target→`Target`, trophy→`Trophy`.

---

## 7. Motion (use `framer-motion` — already a dependency; see `src/lib/motion.ts`)

- **Transitions:** `.18s` (small color/bg) · `.2–.25s` (cards, buttons) · `.22s cubic-bezier(.4,0,.2,1)` (sidebar width — already in `side-nav.tsx`). Spring lift: `cubic-bezier(.34,1.4,.42,1)`.
- **Hover lift:** `translateY(-1px)` buttons / `-2px` cards, usually + border brighten.
- **Heatmap cell hover:** `scale(1.28) brightness(1.3)`.
- **Ambient loops:** flame breathe (`scale 1↔1.04`, 2.4s), live-dot pulse (`opacity 1↔0.4`, 2s) — already in `globals.css` as `noct-livedot`, `ambientPulse`.
- **Marketing reveal:** `[data-reveal]` fade-up is already in `globals.css`; keep using it.
- Respect `prefers-reduced-motion` (already wired). No autoplay beyond the small living accents.

---

## 8. Voice & guardrails

- **Privacy is the through-line.** Surface "zero-knowledge / encrypted / on-device / anonymous"
  reassurance wherever data appears, in the soft indigo info-box (`rgba(99,102,241,0.05)` bg,
  lock icon, `text-secondary` copy). The `PrivacyBadge` component already encodes this.
- **Earn, don't bestow.** Momentum/economy language is about consistency and real utility —
  never vanity points or purchasable currency.
- **Restraint with color.** A screen is mostly neutral + one accent. Amber/rose appear only
  where they mean streak/reward or exam-critical/destructive.
- **No slop.** No gradient-for-its-own-sake, no rounded-card-with-left-accent-border cliché,
  no emoji, no filler stats. Every element earns its place.
