# Nocturne — "Surgical" Theme Migration Guide

> **Source of truth:** `Nocturne Landing v2.dc.html` (project root).
> This document explains how to carry that page's theme across every page in `pages/01–10`.
> Where this file conflicts with `DESIGN_SYSTEM.md` (indigo, Inter, rounded app corners),
> **this file wins**. `DESIGN_SYSTEM.md` remains valid for layout structure, spacing rhythm,
> component inventory and behavior.

---

## 0. The theme in one paragraph

Matte, monochrome, instrument-like. A near-black ground, 1px hairlines doing all of the
structural work, near-square corners, and exactly **one** accent: surgical crimson `#FF3B30`,
reserved for data that matters (Red Zone, top confidence, the active state, the primary CTA).
No gradients-as-decoration, no glassmorphism icons, no drop shadows, no multi-color blobs.
Atmosphere comes from a single low-opacity topographic contour field — live in heroes,
blurred to near-invisibility inside structural cards.

### What changes vs. the current system

| Area | Old (`DESIGN_SYSTEM.md`) | New (Surgical) |
|---|---|---|
| Accent | Indigo `#6366F1` structural + rose/violet/amber/teal semantics | **Crimson `#FF3B30` only.** Everything else is grayscale |
| Surfaces | Blue-tinted `#09090F → #1C1B28` | Neutral charcoal `#0A0A0A → #1C1C1E` (no blue cast) |
| Borders | Solid hex `#191827 / #1E1E2E / #2D2B45` | White alpha hairlines `rgba(255,255,255,.05/.08/.14)` |
| Text | Slate `#E2E8F0 / #94A3B8 / #5B6478` | Neutral `#EDEDED / #9A9A9F / #76767B` |
| UI font | Inter | **Geist** |
| Display font | Inter 600 | **Archivo** (condensed, `font-stretch:82%`) |
| Mono | JetBrains Mono | **Geist Mono** |
| Radius | 2px → 18px, two zones | **0–2px everywhere.** Pills only for true toggles (rare) |
| Brand gradient | `linear-gradient(145deg,#6366F1,#8B5CF6)` | Retired. Logo is the eclipse mark (§7) |
| Ambient glow | One radial tint per page | Contour field (§6). No radial color glows |
| Elevation | Lighter surface + border | Same, but steps are smaller and borders are alpha |

---

## 1. Color tokens

Drop these into `globals.css` `@theme` (replacing the indigo/slate set).

### 1.1 Surfaces

| Token | Value | Use |
|---|---|---|
| `--color-bg-base` | `#0A0A0A` | Page / body |
| `--color-bg-card` | `#0C0C0D` | Cards, app windows, panels, tables |
| `--color-bg-raised` | `#111112` | Tiles on cards (file chips, inputs-on-cards) |
| `--color-bg-input` | `#111112` | Form inputs |
| `--color-bg-hover` | `rgba(255,255,255,0.03)` | Row/tab hover, inactive-selected |
| `--color-bg-selected` | `rgba(255,255,255,0.05)` | Selected tab / segmented option |
| `--color-bg-zebra` | `rgba(255,255,255,0.025)` | Alternating table rows |
| `--color-bg-scrollthumb` | `#1C1C1E` | Scrollbar thumb |

Rule: a card is **one** step lighter than its parent, never more. Page `#0A0A0A` → card
`#0C0C0D` → tile `#111112`. The difference should be barely perceptible; the hairline
border is what defines the edge.

### 1.2 Borders (all 1px solid)

| Token | Value | Use |
|---|---|---|
| `--color-border-faint` | `rgba(255,255,255,0.05)` | Row separators inside tables/lists |
| `--color-border` | `rgba(255,255,255,0.08)` | **Default.** Cards, sections, dividers, nav (scrolled) |
| `--color-border-strong` | `rgba(255,255,255,0.14)` | Table header underline, secondary buttons, graph nodes |
| `--color-border-dashed` | `1px dashed rgba(255,255,255,0.18)` | Drop zones, empty states only |

Sections are separated by a full-width `border-bottom: 1px solid var(--color-border)` —
not by background changes.

### 1.3 Text

| Token | Value | Use |
|---|---|---|
| `--color-text-primary` | `#EDEDED` | Headings, primary values, active labels |
| `--color-text-hover` | `#FFFFFF` | Link / button hover only |
| `--color-text-soft` | `#CFCFD2` | Dense body in tables / spec rows |
| `--color-text-secondary` | `#9A9A9F` | Body copy, descriptions, nav links |
| `--color-text-tertiary` | `#76767B` | Eyebrows, metadata, inactive tabs, table headers |
| `--color-text-muted` | `#5E5E62` | Row IDs, timestamps, struck prices |
| `--color-text-disabled` | `#4A4A4E` | Inactive step descriptions, disabled |
| `--color-text-inverse` | `#0A0A0A` | Text on crimson or on `#EDEDED` buttons |

Second-line headline trick (hero): primary line `#EDEDED`, the second line in crimson
(`"Zero noise."`). Use at most once per page.

### 1.4 The accent

| Token | Value | Use |
|---|---|---|
| `--color-red` | `#FF3B30` | Red Zone, top-confidence numbers, primary CTA fill, active tab rule, progress fill, eyebrows, step numbers |
| `--color-red-hover` | `#FF5147` | Hover on crimson fills |
| `--color-red-border` | `rgba(255,59,48,0.45)` | Outlined red badges, "Red" graph nodes, toast border |
| `--color-red-rule` | `rgba(255,59,48,0.40)` | Highlighted column divider |
| `--color-red-wash` | `rgba(255,59,48,0.04–0.05)` | Highlighted plan card / highlighted table column background |
| `--color-red-light` | `rgba(255,120,110,1)` | Focus-mode top contour line only |

**Allowed uses of crimson (exhaustive):**
1. Red Zone labels, scores and bars (`RED`, `0.94`).
2. The single most important metric on a screen.
3. Primary CTA fill (one per viewport).
4. Active-state indicators: 1–2px top/bottom rule on the active tab, progress bars, stepper fill.
5. Section eyebrows (`PATH A`, `PRICING`) and editorial step numbers (`01 02 03`).
6. 5–6px square bullet markers (spec bar, hero eyebrow).
7. The top contour level in ambient fields.

Anything else is grayscale. If a screen has more than ~6 crimson elements visible at once,
remove some.

### 1.5 Semantic remapping (old → new)

| Old semantic | Old color | New treatment |
|---|---|---|
| Red Zone / exam-critical | Rose `#F43F5E` | `#FF3B30` |
| Likely Zone | Violet `#8B5CF6` | `#9A9A9F` text, `#76767B` label, gray bar |
| Momentum / streak / reward | Amber `#FBBF24` | `#EDEDED` value; crimson only for the *live* streak number |
| Mastered / success / live | Teal `#2DD4BF` | `#EDEDED` + mono `[✓]`; status dot `#EDEDED` |
| Warning | Amber | `#EDEDED` text with `1px solid rgba(255,255,255,0.14)` box + mono `!` prefix |
| Destructive | Rose | Crimson outline button (`border:1px solid #FF3B30; color:#FF3B30; background:transparent`) |
| Brand / selected | Indigo | `#EDEDED` (selected text) + crimson 1–2px rule |

### 1.6 Tinting recipe

- Fill: `rgba(255,59,48,0.04–0.06)` (never higher)
- Border: `rgba(255,59,48,0.40–0.50)`
- Text/glyph: full `#FF3B30`

Neutral equivalent: fill `rgba(255,255,255,0.03–0.05)`, border `rgba(255,255,255,0.14)`.

---

## 2. Typography

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
```
Next.js: use `next/font/google` for `Geist`, `Geist_Mono`, and `Archivo` (with `axes: ['wdth']`).

| Token | Stack | Role |
|---|---|---|
| `--font-sans` | `'Geist', system-ui, sans-serif` | Body, UI, buttons, nav |
| `--font-display` | `'Archivo', sans-serif` + `font-stretch: 82%` | H1/H2/H3 headlines only |
| `--font-mono` | `'Geist Mono', monospace` | Numbers, metrics, eyebrows, labels, table data, file names, terminal |

Body: `15px / 1.6`, `#EDEDED`, `-webkit-font-smoothing: antialiased`.

### Scale

| Role | Font | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|---|
| Hero H1 | Archivo 82% | `clamp(46px, 6.2vw, 92px)` | 600 | 0.95 | -0.035em |
| Section H2 | Archivo 82% | `clamp(34px, 4.6vw, 64px)` | 600 | 0.98–1.0 | -0.03 to -0.035em |
| Sub-section H3 | Archivo 82% | `clamp(28px, 3vw, 40px)` | 600 | 1.02 | -0.03em |
| App page H1 | Archivo 82% | 32–36px | 600 | 1.05 | -0.03em |
| Card title | Geist | 20–22px | 500 | 1.3 | -0.015em |
| Lead paragraph | Geist | 16–17px | 400 | 1.6 | 0 |
| Body | Geist | 14.5–15px | 400 | 1.6 | 0 |
| Small / UI | Geist | 13–13.5px | 400–500 | 1.5 | 0 |
| Big metric | Geist Mono | 44–56px | 400 | 1.05 | -0.02em |
| Price | Geist Mono | 48px | 400 | 1 | -0.03em |
| Table data | Geist Mono | 12–12.5px | 400 | 1.6 | 0 |
| Eyebrow / label | Geist Mono UPPERCASE | 10.5–11px | 400–500 | 1.4 | **0.12–0.18em** |
| Editorial step no. | Geist Mono | `clamp(28px,3vw,40px)` | 400 | 1 | 0.24em |
| Logotype | Geist | 13px | 600 | 1 | **0.34em** |

Rules:
- Headlines use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.
- Weight never exceeds 600. Display contrast comes from size + condensed width, not weight.
- Negative tracking on Archivo; wide positive tracking on mono uppercase. Never mix.
- Every number that could change (scores, counts, durations, prices, timestamps) is mono.
- Minimum text size 10.5px, and only for mono uppercase labels.

---

## 3. Shape, spacing, layout

### Radius
| Token | Value | Use |
|---|---|---|
| `--radius-none` | `0` | Cards, windows, tables, tabs, tiles, nodes, toasts |
| `--radius-btn` | `2px` | Buttons and inputs |
| `--radius-pill` | `9999px` | Avoid. Only a true on/off switch if one is unavoidable |

This replaces the 11–18px "app zone" in `DESIGN_SYSTEM.md §4`. App surfaces are square too.
Window-chrome dots are **7–8px squares**, `rgba(255,255,255,0.16)` (not colored circles).

### Spacing
- Container: `max-width: 1280px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 40px)`.
- Marketing section padding: `clamp(88px, 10vw, 140px)` vertical.
- App page padding: `40px clamp(20px,4vw,40px) 96px`; content `max-width: 1080px`.
- Card padding: `28–32px` (feature), `20–22px` (data panels), `12–14px` (rows/tiles).
- Asymmetric splits: `grid-template-columns: minmax(0,1.05fr) minmax(0,1fr)` or `0.9fr / 1.1fr`,
  gap `clamp(40px, 6vw, 100px)`. Avoid symmetric 3-up card grids for features; use
  editorial number rows (`clamp(84px,10vw,140px) | 1fr`) separated by top hairlines.
- Always flex/grid + `gap`; never sibling margins.
- Breakpoint: **960px** — splits collapse to one column, sticky columns go static,
  center nav links hide (keep their space so right-side actions don't shift).

### Elevation
- **Zero `box-shadow`** in default mode. Depth = surface step + hairline.
- Overlays/popovers: same `#0C0C0D` + `1px solid rgba(255,255,255,0.14)`; no shadow.
- The only blur used is structural: nav on scroll (`blur(14px)`) and contour cards (`blur(60px)`).

---

## 4. Components

### Navigation (marketing)
```
position: fixed; top:0; height:64px; grid-template-columns: 1fr auto 1fr;
default:  background: rgba(10,10,10,0); border-bottom: 1px solid transparent;
scrolled (>12px): background: rgba(10,10,10,0.82); backdrop-filter: blur(14px);
                  border-bottom-color: rgba(255,255,255,0.08);
transition: background-color .25s, border-color .25s;
```
Left: eclipse mark (24px) + `NOCTURNE` logotype (gap 12px). Center: links 13px `#9A9A9F`,
gap 36px, hover `#EDEDED`. Right: `Log in` (text button) + `Get started →` (crimson).

### Buttons
| Variant | Style |
|---|---|
| Primary | `background:#FF3B30; color:#0A0A0A; height:44px (34 nav / 50 footer); padding:0 20px; radius:2px; font 14px/500`; hover `#FF5147` |
| Secondary (light) | `background:#EDEDED; color:#0A0A0A`; hover `#FFFFFF` |
| Outline | `border:1px solid rgba(255,255,255,0.16); color:#EDEDED; background:transparent` |
| Text | `color:#9A9A9F`, hover `#EDEDED`, trailing mono `→` |
Trailing glyphs (`→ ↓`) are set in Geist Mono. No icons inside buttons otherwise.

### Tabs / segmented
- **Path tabs:** grid of equal cells inside a 1px bordered box; active cell
  `background: rgba(255,255,255,0.05); color:#EDEDED; border-top:1px solid #FF3B30`;
  inactive `color:#76767B`. Two lines: mono label (10.5px, 0.16em) + Geist 14px/500 title.
- **Subject tabs / stepper:** same, active marked with a 1–2px crimson rule
  (`box-shadow: inset 0 -1px 0 #FF3B30` or an absolutely-positioned 2px bar that
  animates `scaleX(0→1)` as a progress indicator).
- **Segmented (billing):** `padding:3px; gap:3px; border:1px solid rgba(255,255,255,0.1)`;
  active `background:#EDEDED; color:#0A0A0A`; mono 10.5px 0.12em.

### App window frame
```
border:1px solid rgba(255,255,255,0.08); background:#0C0C0D;
title bar: height 36–40px; grid 60px|1fr|60px; border-bottom hairline;
left: three 7–8px squares rgba(255,255,255,0.16); center: mono 11px #76767B path;
right: mono 10px 0.12em status ("LOCAL", "OFFLINE").
```

### Data rows / metric blocks
- Metric block: mono 10.5px eyebrow `#76767B` above a 44px mono value.
  Crimson only if it is the top metric.
- Ranked row: `grid 44px | 1fr | 56px | 72px`; rank (mono 11px `#5E5E62`), term (13.5px)
  with a **1px** confidence bar underneath (`track rgba(255,255,255,0.08)`, fill crimson
  for RED, `#9A9A9F` for LIKELY), mono value, mono zone label right-aligned.
- Key/value spec rows: `grid 110–140px | 1fr`, mono label `#76767B` 0.1–0.12em,
  value `#CFCFD2`, top hairline per row, bottom hairline on the last.

### Benchmark / comparison table
- Mono 12.5px. Header: 10.5px 0.14em `#76767B`, `border-bottom: 1px solid rgba(255,255,255,0.14)`.
- Rows: zebra `rgba(255,255,255,0.025)` on odd rows; `border-top: 1px solid rgba(255,255,255,0.05)`.
- Row IDs `R01…` in `#5E5E62`. Marks in mono: `[✓]`, `[ ]`, `[~]` — never icons.
- Highlighted column: `border-left:1px solid rgba(255,59,48,0.4); background:rgba(255,59,48,0.05)`;
  header text crimson.

### Pricing cards
- One bordered strip split into 3 cells by `border-left` hairlines (not 3 floating cards).
- Highlighted tier: `background: rgba(255,59,48,0.04)` + 2px crimson top bar + crimson CTA
  + crimson `+` feature marks. Others: outline CTA, `#76767B` marks.
- Price mono 48px; yearly shows struck original price in `#5E5E62`.

### Terminal / log
- `background:#0A0A0A`, mono 12.5px / 1.95. Columns: `ts (#5E5E62) | [src] (#76767B) | msg (#9A9A9F) | value`.
- Important lines `#EDEDED`, red values crimson. Block cursor `8×14px #EDEDED`, 1s `steps(1)` blink.
- New lines enter with `noct-in` (opacity + 8px rise, .25s).

### Badges
Mono 10px, 0.16em, `padding:3px 7px`, square. Highlight: crimson text + `rgba(255,59,48,0.45)` border.
Neutral: `#9A9A9F` + `rgba(255,255,255,0.14)` border.

### Toast (system)
Fixed top-right (`top:76px`), `background:#000; border:1px solid rgba(255,59,48,0.45)`,
mono 11.5px / 1.9, each line prefixed by a crimson `>`; lines stagger in .25s apart.

### Forms (auth, settings)
`height:44px; background:#111112; border:1px solid rgba(255,255,255,0.08); radius:2px;
padding:0 14px; color:#EDEDED; font 14px Geist`. Focus: `border-color: rgba(255,255,255,0.3)`
(no glow ring). Error: `border-color:#FF3B30` + mono 11px crimson message below.
Labels: mono uppercase 10.5px `#76767B`.

---

## 5. Motion

| Use | Spec |
|---|---|
| Color/bg hover | `.2s` |
| Nav scroll state | `.25s` background-color + border-color |
| Content enter | `@keyframes noct-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }` `.3–.5s ease` |
| Toast | `noct-toast` (−12px → 0) `.45s cubic-bezier(.22,1,.36,1)` |
| Canvas zoom | `transform 1.6s cubic-bezier(.22,1,.36,1)` |
| Stepper progress | linear `scaleX` over 6–7s via Web Animations API; pause on hover |
| Scroll-scrubbed 3D | Progress lerp `cur += (target − cur) × 0.1` per frame |

No hover lifts (`translateY`) — they read as "SaaS". Hover = color change only.
Honor `prefers-reduced-motion`: render contour fields once, skip typing/zoom animations,
show final states.

---

## 6. Ambient contour field

The only atmospheric effect. A `<canvas>` absolutely filling its host.

**Algorithm:** 3D Perlin noise sampled on a grid (cell 22px hero, 26px footer, 34px cards),
z advanced by `t × 0.08`; marching squares extracts iso-lines; all segments for one level
batched into a single `stroke()`.

| Variant | Levels | Line width | Non-top alpha | Top level (f > 0.8) |
|---|---|---|---|---|
| Hero | 12 | 1px | `0.03 + 0.10f` of `#EDEDED` | crimson, alpha 0.5 |
| Footer | 12 | 1px | same × breath `0.55 + 0.45·sin(t·0.9)` | crimson |
| Card | 7 | 2.5px (3px top) | `0.06 + 0.22f` | crimson 0.5 |

- **Hero:** pointer adds a Gaussian bump (`+0.3·exp(−d²/14000)`) that the cursor drags
  through the field; a mono `X 0000 Y 0000 Z 0.000` readout follows the cursor at +18px.
  Overlay `linear-gradient(90deg,#0A0A0A 0%,rgba(10,10,10,.7) 38%,transparent 70%)`
  keeps copy legible; bottom fade `140px` to `#0A0A0A`.
- **Card:** canvas at DPR ≤ 0.6, drawn every other frame, under
  `backdrop-filter: blur(60px); background: rgba(12,12,13,0.5)`. Use on 2–3 structural
  cards per page max (cross-reference panel, privacy, comparison table).
- **Footer:** radial vignette `radial-gradient(ellipse 60% 70% at 50% 45%, rgba(10,10,10,.92), rgba(10,10,10,.2))`.
- Pause any field not intersecting the viewport (`IntersectionObserver`). Size from
  `ResizeObserver` **and** re-check host size each frame (hosts can be 0×0 at mount).

Port as a single hook: `useContourField(ref, { variant: 'hero' | 'card' | 'footer', intensity })`.

---

## 7. Logo — red lunar eclipse

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <defs><mask id="nlm"><rect width="24" height="24" fill="#fff"/><circle cx="11" cy="13" r="10.7" fill="#000"/></mask></defs>
  <circle cx="13.3" cy="10.7" r="9.5" fill="#FF3B30" mask="url(#nlm)"/>
  <circle cx="11" cy="13" r="9.4" stroke="#EDEDED" stroke-width="1.25"/>
</svg>
```
- White 1.25px ring = moon; offset crimson disc masked so only a crescent shows past the rim,
  with a hairline black gap between them.
- Stroke 1.25px at ≤ 24px, 1px at ≥ 32px. Unique `mask id` per instance.
- Sizes: nav 24px, footer bar 16px, CTA block 56px. Favicon: same mark on a `#0A0A0A` square, ring 1.6px.
- Lockup: mark + `NOCTURNE` (Geist 600, 13px, 0.34em), gap 12px.
- Replaces the indigo→violet gradient tile everywhere (sidebar, auth panels, error pages, emails).

---

## 8. 3 AM Deep Focus Mode (global easter egg)

Trigger: clicking the eclipse mark in any nav/sidebar. Toggle; **not** persisted
(refresh returns to standard). Implement as `data-focus="on"` on `<html>` and drive with
CSS variables rather than the attribute-substring selectors used in the prototype:

| Token | Standard | Focus |
|---|---|---|
| `--color-bg-base` / `--color-bg-card` / `--color-bg-raised` | `#0A0A0A` / `#0C0C0D` / `#111112` | `#000000` all |
| blurred-card overlay | `rgba(12,12,13,0.5)` | `rgba(0,0,0,0.6)` |
| `--color-border*` | `.05 / .08 / .14` | `rgba(255,255,255,0.035)` |
| nav scrolled bg | `rgba(10,10,10,0.82)` | `rgba(0,0,0,0.85)` |
| crimson text | — | `text-shadow: 0 0 14px rgba(255,59,48,0.65)` |
| crimson fills | — | `box-shadow: 0 0 16px rgba(255,59,48,0.5)` |
| crimson outlines | — | `box-shadow: 0 0 14px rgba(255,59,48,0.35)` |
| logo | — | `filter: drop-shadow(0 0 6px rgba(255,59,48,0.8))` |
| contour lines | `#EDEDED` | crimson, alpha × 1.5; top level `rgb(255,120,110)` at 0.75 |
| gradient fades | `#0A0A0A` stops | `#000` stops |

On enable, show the toast (auto-dismiss 4.2s):
```
> SYSTEM STATE: 03:00_LOCAL_TIME
> NOISE FILTER: MAXIMUM
> RED ZONE: ACTIVE
```
This is the **only** context where glows/shadows are allowed.

---

## 9. Page-by-page application

For each page: keep the structure described in `pages/NN-*.md`; apply the swaps below.

### 01 — Landing
Rebuild from `Nocturne Landing v2.dc.html`. Section order: Nav → Hero (path tabs + subject
tabs + inspector) → Engine (300vh pinned three.js sequence) → Demo carousel (3 steps) →
Path A (sticky left, editorial 01/02/03) → Path B (blurred cross-ref card + spec rows) →
Privacy key-chain card → Systems log table → Pricing → Spec bar → Footer CTA.
three.js: `0.160`, `MeshStandardMaterial({ color:0x151517, roughness:0.8, metalness:0.1 })`,
edges `LineBasicMaterial` `#EDEDED` 0.5 opacity (core layer crimson), one crimson
`PointLight`. Zero-opacity line layers must be `visible=false` + `depthWrite:false`.

### 02 — Login
- Left brand panel: replace gradient wordmark tile and ambient radial with a **hero-variant
  contour field** (no pointer readout) + `#0A0A0A` → transparent left gradient. Headline in
  Archivo 82%, one crimson phrase allowed.
- Right form panel: `#0A0A0A`, `border-left` hairline. Google button = Secondary (light);
  email fallback = inputs per §4 Forms; submit = Primary crimson.
- Passphrase unlock: mono label `VAULT PASSPHRASE`; on success show a mono status line,
  not a green check.

### 03 — Sign Up (4 steps)
- Step indicator: 4 cells in a bordered strip, active cell crimson 2px top rule, done cells
  `#EDEDED` with mono `[✓]`, future `#5E5E62`.
- Eyebrow chip "End-to-end encrypted setup": mono badge (neutral), 5px crimson square bullet.
- Recovery Kit card: `#0C0C0D`, square corners, mono key text 13px `#EDEDED`, a dashed
  border only around the downloadable kit area.
- Step 3 "Your vault is ready": 56px eclipse mark replaces the lock glyph.

### 04 — Legal
- Header: eclipse mark + `NOCTURNE / LEGAL` (mono breadcrumb `#76767B`).
- TOC: mono 11px uppercase list; active item `#EDEDED` with 1px crimson left rule (2px wide bar
  is too heavy); inactive `#76767B`.
- Body: Geist 15px / 1.7, `max-width:720px`, H2 Archivo 28px. Section numbers in mono `§ 03`.
- Tables (cookie lists, sub-processors) use the benchmark-table style.

### 05 — Help Center
- Search: full-width input, 52px tall, mono placeholder `SEARCH 48 ARTICLES`.
- Category tiles → editorial rows (mono index + title + one-line desc + `→`) separated by
  hairlines, not icon cards.
- Accordion (`help-accordion.tsx`): rows with top hairline; toggle glyph mono `+` / `−`;
  open item title `#EDEDED`, closed `#CFCFD2`. No chevron icons, no rounded panels.

### 06 — 404 / 500
- Full-viewport **hero contour field** with pointer readout; centered block.
- Big code in Geist Mono 120–160px, `#EDEDED`, with `404` → the `0` replaced by the eclipse
  mark is acceptable; 500 code in crimson (it's a real alarm).
- Copy: Archivo 36px headline, Geist 16px body. Actions: Primary + Text button.
- 500 adds a terminal block (`[err] …`, request id in mono) using the Terminal spec.

### 07 — Vault Dashboard
- **App shell sidebar:** `#0A0A0A`, `border-right` hairline, width 232px. Nav items 13.5px,
  height 36px, square; active `background:rgba(255,255,255,0.05); color:#EDEDED` + 2px crimson
  left bar; inactive `#9A9A9F`. Icons lucide 16px stroke 1.5, `currentColor`.
  Top: eclipse mark + logotype (focus-mode trigger lives here in-app).
- Page H1 "Your vault" Archivo 34px; subtitle `#9A9A9F`.
- Session cards: `#0C0C0D`, square, hairline; mono course code eyebrow, title 17px/500,
  mono meta row; Red Zone count as crimson mono number. Grid gap 1px with a shared border
  (cells divided by hairlines) reads better than gapped floating cards.
- Momentum ribbon: one hairline-bordered strip of mono stats; only the live streak is crimson.
- Empty vault: dashed drop zone per §1.2, mono `DROP AUDIO + SLIDES`.
- Billing: reuse the landing pricing strip verbatim. Settings danger zone: crimson outline button.

### 08 — Session Workspace
- Top bar 54px `#0A0A0A` + hairline; mode switch = segmented control (§4).
- **Lecture:** timeline spine `#0A0A0A` top hairline; playhead 1px `#EDEDED`; Red Zone
  segments on the spine as crimson 2px ticks; slide-density heatmap in grayscale steps
  (`rgba(255,255,255,0.04 → 0.3)`) with the peak cell crimson.
- **Study ("night before"):** this is where Deep Focus Mode feels native — offer it as a
  visible toggle here as well as the logo trigger.
- **Notes:** document `max-width:720px`, Archivo headings, mono term chips.
- **Ask:** answers cite sources as mono `L14 · 21:40` links in `#9A9A9F`, hover `#EDEDED`.
  Input bar = form input with Primary send button.
- Transcript: mono timestamps `#5E5E62`; highlighted Red Zone terms underlined 1px crimson
  (no background highlight).

### 09 — Momentum
- Hero band: drop the amber→rose wash. Use a **card-variant contour field** under blur.
  Streak number mono 56px crimson; label mono `DAY STREAK`.
- Day chips: 28px squares; studied `#EDEDED` fill with `#0A0A0A` mono day; missed hairline only;
  today crimson 1px outline. No amber glow.
- Charts: 1px lines `#9A9A9F`, axis mono 10.5px `#5E5E62`, gridlines `rgba(255,255,255,0.05)`;
  exactly one series may be crimson (the one the page is about).
- Rewards/milestones: editorial rows, mono `[✓]` / `[ ]`.

### 10 — Community
- Material-first lists: decks/threads as table-like rows (mono index, title, mono meta,
  mono counts), zebra rows, hairline separators.
- Tags: neutral mono badges. "Red Zone verified" badge = crimson badge (the only colored tag).
- Room sub-panels: square `#0C0C0D` panels, hairline dividers; no 14–18px radii.
- Avatars: 24px squares, `#111112` fill, mono initials `#9A9A9F` (no gradients).

---

## 10. Do / Don't

**Do**
- Let hairlines carry structure; let whitespace carry hierarchy.
- Put every number in Geist Mono.
- Use crimson as a pointer: one glance should land on the one thing that matters.
- Prefer editorial rows and dense tables over icon-card grids.

**Don't**
- Gradients for decoration, colored radial glows, glass cards with floating icons.
- `box-shadow` outside Focus Mode.
- Rounded corners above 2px.
- Any second accent color (no indigo, violet, amber, teal, green "success").
- Emoji, filled/duotone icons, colored icon chips.
- Hover lifts or scale-up effects.

---

## 11. Migration checklist

1. Replace `@theme` tokens in `globals.css` with §1 and §3 values; delete indigo/rose/violet/amber/teal scales.
2. Swap fonts via `next/font` (Geist, Geist Mono, Archivo w/ `wdth` axis); set `--font-display`.
3. Global find: `rounded-(lg|xl|2xl|3xl|full)` → `rounded-none` / `rounded-[2px]` (keep `full` only for status dots).
4. Remove all `shadow-*` utilities and gradient backgrounds; replace gradient logo tile with `<EclipseMark/>`.
5. Build shared primitives: `EclipseMark`, `AppWindow`, `MonoLabel`, `MetricBlock`, `RankedRow`,
   `SpecRow`, `BenchmarkTable`, `Segmented`, `Toast`, `useContourField`.
6. Add Focus Mode provider (`data-focus` on `<html>`, CSS-variable swaps in §8, toast).
7. Re-skin pages in this order: Landing → Auth (02/03) → App shell + Vault (07) → Session (08)
   → Momentum (09) → Community (10) → Legal/Help/Errors (04/05/06).
8. QA every page in both standard and Focus Mode, at 1440px and 390px, with reduced motion on.
