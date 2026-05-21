<!-- App renamed from Nocturne to Nocturne — 2026-05-19 -->

# Nocturne — Design System
> Reference this file before generating, modifying, or reviewing any UI component.
> Every color, spacing, motion, and typography decision flows from here.
> When in doubt: do less, not more. Clinical clarity over decorative complexity.

---

## 0. Tool Stack & Usage Rules

### Active MCPs / Skills
| Tool | Purpose | When to use |
|---|---|---|
| **21st.dev Magic MCP** | Generate component variants via `/ui` prompt | New components, layout patterns, interactive elements |
| **shadcn/ui** | Primitive accessible components (Dialog, Tooltip, Select, etc.) | Base layer — always prefer shadcn primitives before custom |
| **Context7 MCP** | Live docs for Next.js, Tailwind, Framer Motion, shadcn | Before writing any API-specific code — verify correct version |
| **ui ux pro max skill** | Opinionated layout + composition rules | Page layouts, information hierarchy decisions |

### Non-negotiable tool rules
1. **Always pull Context7 docs** before using any library API — Next.js 15, Tailwind v4, Framer Motion, and shadcn APIs change. Never write from memory.
2. **Always start from a shadcn primitive** before reaching for a 21st.dev component. If shadcn has it, use it. 21st.dev is for enrichment, not replacement.
3. **When using `/ui` with 21st.dev**, include the relevant token values from this file in your prompt so generated components match the Nocturne theme out of the box.
4. **Never invent a color, radius, shadow, or spacing value** not defined in this file. If you need one that doesn't exist, surface the gap — don't silently add it.

### Karpathy guidelines (from `CLAUDE.md`)
These four principles govern all Claude Code sessions:
- **Think Before Coding** — state assumptions, ask before guessing, push back when a simpler path exists
- **Simplicity First** — minimum code that solves the problem, no speculative abstractions
- **Surgical Changes** — touch only what the task requires, mention (don't delete) unrelated dead code
- **Goal-Driven Execution** — define success criteria before implementing, verify after

---

## 1. Aesthetic Philosophy

**Clinical / Productivity.** Nocturne is a tool for people doing serious cognitive work. The UI should disappear. The student's content — the transcript, the slides, the Red Zone — should dominate every view.

### Principles
- **Information density over whitespace.** This is not a marketing site. Pack meaning into every row.
- **Color carries semantic weight.** Rose = exam-critical (Red Zone). Violet = inferred (Likely Zone). Indigo = system / action. Never use these colors decoratively.
- **Motion is functional, not decorative.** Animate to convey state change or guide attention. Never animate for style alone.
- **Hierarchy through weight and size, not decoration.** No gradients, drop shadows, or decorative borders on content. Reserve those for interactive affordances.
- **Exclusivity through restraint.** The product looks smart because it doesn't try to look pretty.

### Anti-patterns (never do these)
- Gradient backgrounds on data surfaces
- Rounded corners >12px on data cards
- Skeleton loaders that don't match the actual content shape
- Toast notifications for non-destructive actions
- Animation on every mount (reserve for meaningful transitions)
- Colored backgrounds on entire sections (only on badges and chips)
- Font sizes below 11px
- More than 3 type sizes in a single view

---

## 2. Color System

### Color philosophy
Nocturne uses a deep indigo-anchored dark palette with purple-tinted surfaces. The background has a subtle blue-black quality — not pure black, not navy, but the color of a clear night sky just before full dark. Indigo is the primary action color. Violet is the Likely Zone semantic color (natural neighbor to indigo). Rose replaces flat red for the Red Zone — warmer and more urgent than clinical red.

### Base palette — CSS custom properties
Define these in `globals.css` via `@theme {}`.

```css
:root {
  /* --- Surfaces --- */
  --color-bg-base:        #09090F;   /* Deep near-black with purple undertone */
  --color-bg-elevated:    #111118;   /* Cards, panels */
  --color-bg-overlay:     #16151F;   /* Modals, popovers */
  --color-bg-subtle:      #1C1B28;   /* Hover states, secondary surfaces */
  --color-bg-input:       #13121C;   /* Input fields */

  /* --- Borders --- */
  --color-border-default: #1E1E2E;   /* Standard card/panel borders */
  --color-border-subtle:  #191827;   /* Dividers, subtle separators */
  --color-border-strong:  #2D2B45;   /* Focused inputs, active states */

  /* --- Text --- */
  --color-text-primary:   #E2E8F0;   /* Main content, headings */
  --color-text-secondary: #94A3B8;   /* Labels, metadata, descriptions */
  --color-text-tertiary:  #5B6478;   /* Placeholder, disabled */
  --color-text-inverse:   #09090F;   /* Text on colored backgrounds */

  /* --- Brand / Action (Indigo) --- */
  --color-indigo-50:      #EEF2FF;
  --color-indigo-100:     #E0E7FF;
  --color-indigo-200:     #C7D2FE;
  --color-indigo-300:     #A5B4FC;
  --color-indigo-400:     #818CF8;   /* Hover states, highlights */
  --color-indigo-500:     #6366F1;   /* PRIMARY ACTION */
  --color-indigo-600:     #4F46E5;   /* Pressed states */
  --color-indigo-700:     #4338CA;
  --color-indigo-800:     #3730A3;
  --color-indigo-900:     #1E1B4B;   /* Deep indigo backgrounds */

  /* --- Red Zone (Rose — warmer than flat red) --- */
  --color-rose-50:        #FFF1F2;
  --color-rose-100:       #FFE4E6;
  --color-rose-200:       #FDA4AF;
  --color-rose-300:       #FB7185;   /* Red Zone highlights */
  --color-rose-400:       #F43F5E;   /* Red Zone badges, labels */
  --color-rose-500:       #E11D48;
  --color-rose-600:       #BE123C;
  --color-rose-900:       #4C0519;   /* Red Zone badge backgrounds */

  /* --- Likely Zone (Violet — neighbors indigo) --- */
  --color-violet-50:      #F5F3FF;
  --color-violet-100:     #EDE9FE;
  --color-violet-200:     #DDD6FE;
  --color-violet-300:     #C4B5FD;   /* Likely Zone highlights */
  --color-violet-400:     #A78BFA;   /* Likely Zone badges */
  --color-violet-500:     #8B5CF6;
  --color-violet-600:     #7C3AED;
  --color-violet-900:     #2E1065;   /* Likely Zone badge backgrounds */

  /* --- Amber (warnings, open questions) --- */
  --color-amber-50:       #FFFBEB;
  --color-amber-100:      #FEF3C7;
  --color-amber-200:      #FCD34D;
  --color-amber-300:      #F59E0B;   /* Warning states, pending badges */
  --color-amber-400:      #D97706;

  /* --- Status --- */
  --color-success:        #6366F1;   /* Indigo — matches primary */
  --color-warning:        #F59E0B;
  --color-error:          #F43F5E;   /* Rose */
  --color-info:           #38BDF8;   /* Sky blue — neutral info */

  /* --- Privacy / Local Mode --- */
  --color-local-bg:       #0D0C1A;   /* Local Mode badge background */
  --color-local-border:   #6366F1;
  --color-local-text:     #818CF8;
}
```

### Semantic color map — use these names in components, not raw hex
| Token | Hex | Use |
|---|---|---|
| `indigo-500` | `#6366F1` | Primary buttons, active nav, links, progress fills, Local Mode dot |
| `indigo-400` | `#818CF8` | Hover states, secondary highlights |
| `rose-300` | `#FB7185` | Red Zone keyword highlights inline in transcript and slides |
| `rose-400` | `#F43F5E` | Red Zone badge text, borders |
| `rose-900` | `#4C0519` | Red Zone badge backgrounds |
| `violet-300` | `#C4B5FD` | Likely Zone highlights |
| `violet-400` | `#A78BFA` | Likely Zone badge text |
| `violet-900` | `#2E1065` | Likely Zone badge backgrounds |
| `amber-300` | `#F59E0B` | Warning states, processing badges |
| `bg-base` | `#09090F` | Page root background |
| `bg-elevated` | `#111118` | All cards and panels |
| `border-default` | `#1E1E2E` | All standard borders |
| `text-primary` | `#E2E8F0` | All primary readable text |
| `text-secondary` | `#94A3B8` | Labels, metadata, helper text |

### Light mode
Nocturne ships **dark mode only** for MVP. Light mode is a post-v1 addition. Do not build light mode tokens or conditionals now. When asked, state this explicitly rather than silently adding light mode variables.

---

## 3. Typography

### Font stack
```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
```

Install via `next/font`:
```ts
import { Inter, JetBrains_Mono } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })
```

### Type scale
| Name | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `display` | 28px | 1.25 | 500 | Page titles only (vault name, session title) |
| `heading` | 20px | 1.3 | 500 | Section headings, panel titles |
| `subheading` | 16px | 1.4 | 500 | Card titles, dialog headers |
| `body` | 14px | 1.6 | 400 | All body copy, descriptions |
| `body-sm` | 13px | 1.55 | 400 | Secondary descriptions, metadata |
| `label` | 12px | 1.5 | 400 | Form labels, table cells |
| `caption` | 11px | 1.4 | 500 | Badges, chips, ALL-CAPS section labels |
| `mono` | 12px | 1.6 | 400 | Recovery key, code snippets, file paths |

### Typography rules
- **Never go below 11px.** Minimum readable size for dense information views.
- **Section labels use ALL CAPS + letter-spacing: 0.07em + `caption` size + `text-secondary` color.** This is Nocturne's primary hierarchy signal. Use it consistently.
- **Transcript text uses `body` (14px) with `text-primary`.** Density matters here — the student is reading fast.
- **Red Zone keywords in transcript are `body` size, `red-200` color, with a subtle `red-500` background chip.** Never increase font size for emphasis — use color and background only.
- **Mono font for:** Recovery Kit keys, encrypted key display, file IDs, timestamps in debug views.

---

## 4. Spacing System

Nocturne uses an **8px base grid**. All spacing values are multiples of 4px minimum, 8px preferred.

```
4px   — xs  — tight internal padding (badge internals, chip padding)
8px   — sm  — standard internal padding, gap between related items
12px  — md  — card internal padding (compact), list item padding
16px  — lg  — card internal padding (standard), section gaps
24px  — xl  — between major sections within a panel
32px  — 2xl — between panels, major layout gaps
48px  — 3xl — page-level padding
```

### Layout rules
- **Three-pane study view** (audio player | transcript | PDF viewer): each pane has `16px` internal padding, `1px` border between panes (no gap — borders only).
- **Sidebar / nav**: `48px` width (icon-only) or `220px` (expanded). Never in-between.
- **Cards**: `border-radius: 8px`, `border: 1px solid var(--color-border-default)`, `background: var(--color-bg-elevated)`, `padding: 16px`.
- **Modals**: `border-radius: 12px`, `max-width: 480px` (standard) or `640px` (content modals), centered with `backdrop-blur(8px)` overlay.
- **Badges/chips**: `border-radius: 999px` (pill), `padding: 2px 8px`, `font-size: 11px`.

---

## 5. Border & Elevation

### Border radius tokens
```
2px  — inputs (subtle, clinical feel)
6px  — buttons, small interactive elements
8px  — cards, panels (standard)
10px — modals, larger overlays
12px — onboarding modal (more inviting)
999px — badges, pills, toggle buttons
```

### Shadow — use sparingly
Nocturne is dark-mode only. Shadows are subtle and primarily used for elevation cues on floating elements.

```css
--shadow-sm:    0 1px 3px rgba(0,0,0,0.4);                   /* Dropdowns, tooltips */
--shadow-md:    0 4px 16px rgba(0,0,0,0.5);                  /* Modals, floating panels */
--shadow-lg:    0 8px 32px rgba(0,0,0,0.6);                  /* Vault unlock modal */
--shadow-indigo: 0 0 0 1px rgba(99,102,241,0.4);             /* Focus ring on primary inputs */
--shadow-rose:   0 0 0 1px rgba(244,63,94,0.4);              /* Focus ring on destructive inputs */
```

**Shadow rules:**
- Cards and panels: **no shadow**. Use borders only.
- Dropdowns, popovers, tooltips: `shadow-sm`
- Modals: `shadow-md` + `backdrop-blur(8px)` on overlay
- Focus rings: use the outline variants above, never the default browser ring

---

## 6. Component Patterns

### Buttons
```
Primary:    bg=indigo-500, text=inverse, hover=indigo-600, border=none, radius=6px, height=36px
Secondary:  bg=transparent, text=primary, border=border-default, hover=bg-subtle, radius=6px
Destructive:bg=transparent, text=rose-400, border=rose-900, hover=rose-900 bg, radius=6px
Ghost:      bg=transparent, text=secondary, no border, hover=bg-subtle, radius=6px
Icon:       32px × 32px, radius=6px, ghost style, tooltip required
```

**Button rules:**
- Never more than one Primary button visible at a time in a single panel.
- Destructive actions always require a confirmation step — never a direct destructive button.
- Loading state: replace button label with a spinner (`animate-spin`) + "Processing…" — never disable and leave blank.

### Badges / Status chips
```
Red Zone:    bg=rose-900,   text=rose-200,   label="Red Zone"
Likely Zone: bg=violet-900, text=violet-200, label="Likely Zone"
Local Mode:  bg=local-bg,   text=local-text, border=local-border, dot=indigo-500 animated pulse
Encrypted:   bg=violet-900, text=violet-200, label="Encrypted"
Processing:  bg=amber-400/20, text=amber-200, label="Processing" with spinner
Syncing:     bg=indigo-900, text=indigo-200, label="Syncing"
```

### Progress bars
- Height: `4px` (standard), `6px` (upload/download progress)
- Track: `bg-subtle`
- Fill: `indigo-500` (standard upload), `violet-400` (ML processing), `indigo-400` (encryption), `violet-500` (model download)
- Always show a label above with current step name and percentage or count
- Never use indeterminate spinners alone for long operations — show meaningful progress

### Input fields
```
background:     bg-input (#13121C)
border:         border-default, 1px
border-radius:  2px (clinical, precise)
focus border:   indigo-500 + shadow-indigo
error border:   rose-300 + shadow-rose
font-size:      14px (body)
height:         36px (standard), 32px (compact)
padding:        0 10px
```

### Transcript view — specific rules
- Each word is a `<span>` with a `data-timestamp` attribute
- Active word (at current playhead): `text-indigo-500`, `bg-indigo-500/20`
- Red Zone keyword: `text-rose-300`, `bg-rose-900/20`, underline style `text-decoration: underline text-decoration-color:rose-900`
- Likely Zone keyword: `text-violet-300`, `bg-violet-900/15`
- Clicked sentence: full sentence row gets `bg-subtle` highlight, fades out over 1.5s

### PDF nav strip (slide heatmap)
- Miniature slide thumbnails in a vertical strip
- Red Zone density score shown as a colored left-border: `0-30% = border-default`, `30-70% = amber-300`, `70-100% = rose-300`
- Active slide: `border-left: 2px solid indigo-500`, `bg-subtle`
- Slide number: `caption` font, `text-tertiary`

### Three-pane study layout
```
┌─────────────────────────────────────────────────────────┐
│ Top bar: session title | Local Mode badge | vault status │
├──────────────┬──────────────────────────┬───────────────┤
│  Audio       │  Transcript              │  PDF Viewer   │
│  player      │  (scrollable)            │  + slide nav  │
│  + waveform  │  keyword hot-links       │  + heatmap    │
│  controls    │  timestamp markers       │  strip        │
│  (20% width) │  (45% width)             │  (35% width)  │
├──────────────┴──────────────────────────┴───────────────┤
│  Bottom bar: Red Zone keywords | Lecture Confidence Score│
└─────────────────────────────────────────────────────────┘
```
- Pane borders: `1px solid border-default` — no gaps, no padding between panes
- Panes are resizable (drag handle: `4px` wide, `bg-subtle`, `hover=indigo-500`)
- On screens <1280px: transcript and PDF stack vertically, audio stays at top

---

## 7. Motion System (Framer Motion)

### Philosophy
Motion in Nocturne serves three purposes only:
1. **State communication** — something changed (upload complete, sync jump, Red Zone found)
2. **Spatial orientation** — where did this element come from / go to
3. **Loading continuity** — something is happening (not frozen)

Never animate for decoration. If removing an animation doesn't reduce clarity, remove it.

### Duration tokens
```ts
export const duration = {
  instant:  0.08,   // Hover states, color changes
  fast:     0.15,   // Button presses, badge appearances
  standard: 0.25,   // Panel transitions, card mounts
  deliberate: 0.4,  // Modal entry, page transitions
  slow:     0.6,    // Onboarding steps, emphasis moments
}
```

### Easing tokens
```ts
export const ease = {
  out:      [0.0, 0.0, 0.2, 1.0],   // Elements entering — decelerate into position
  in:       [0.4, 0.0, 1.0, 1.0],   // Elements leaving — accelerate out
  inOut:    [0.4, 0.0, 0.2, 1.0],   // State changes — smooth both ways
  spring:   { type: 'spring', stiffness: 400, damping: 30 },  // Playhead jumps
  snappy:   { type: 'spring', stiffness: 600, damping: 35 },  // Sync engine jumps
}
```

### Named animation variants
Use these as the canonical Framer Motion variants throughout the codebase.

```ts
// Standard card / panel mount
export const fadeUp = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.standard, ease: ease.out } },
  exit:    { opacity: 0, y: -4, transition: { duration: duration.fast, ease: ease.in } },
}

// Modal entry (from center, slight scale)
export const modalEntry = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: duration.deliberate, ease: ease.out } },
  exit:    { opacity: 0, scale: 0.97, transition: { duration: duration.fast, ease: ease.in } },
}

// Transcript word highlight (sync jump)
export const wordHighlight = {
  active:   { backgroundColor: 'rgba(99,102,241,0.15)', transition: { duration: duration.instant } },
  inactive: { backgroundColor: 'rgba(0,0,0,0)', transition: { duration: 1.5, ease: ease.out } },
}

// Slide transition in PDF viewer (sync jump)
export const slideJump = {
  enter: { opacity: 0, x: 12 },
  center:{ opacity: 1, x: 0, transition: ease.snappy },
  exit:  { opacity: 0, x: -8, transition: { duration: duration.fast } },
}

// Progress bar fill
export const progressFill = {
  initial: { width: '0%' },
  animate: (pct: number) => ({
    width: `${pct}%`,
    transition: { duration: duration.deliberate, ease: ease.out },
  }),
}

// Red Zone keyword pop (when first detected)
export const redZonePop = {
  hidden:  { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 500, damping: 28 } },
}

// Staggered list mount (session list, keyword list)
export const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.04 } },
}
export const staggerItem = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.standard, ease: ease.out } },
}

// Local Mode dot pulse
export const localPulse = {
  animate: {
    scale: [1, 1.3, 1],
    opacity: [1, 0.6, 1],
    transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
  },
}
```

### Motion rules
- **The sync engine jump (transcript → PDF → audio) uses `snappy` spring.** It should feel physical and immediate, not floaty.
- **Modal backdrops use `duration.deliberate`.** These are high-stakes interactions (vault unlock, onboarding warning) — the pacing should feel deliberate, not rushed.
- **Progress bars animate on value change, not on mount.** Use `animate` prop, not `initial` + `animate` sequence.
- **`AnimatePresence` is required for all conditional renders** (modals, panels, toast-equivalents). Never unmount without an exit animation.
- **Respect `prefers-reduced-motion`.** Wrap all motion values in a utility that returns `duration: 0` and `ease: 'linear'` when the media query is active.

```ts
// utils/motion.ts
import { useReducedMotion } from 'framer-motion'

export function useMotion() {
  const reduced = useReducedMotion()
  return {
    duration: reduced ? { instant: 0, fast: 0, standard: 0, deliberate: 0, slow: 0 } : duration,
    ease,
  }
}
```

---

## 8. Iconography

Use **Lucide React** exclusively. No mixing icon sets.

```ts
import { Shield, Lock, FileText, Mic, BookOpen, Zap, AlertTriangle, Download, ChevronRight } from 'lucide-react'
```

### Icon size rules
| Context | Size | Stroke |
|---|---|---|
| Inline with text | 14px | 1.5 |
| Button icons | 16px | 1.5 |
| Card icons / section headers | 18px | 1.5 |
| Empty state illustrations | 32px | 1.25 |
| Onboarding / hero moments | 48px | 1.0 |

**Never use filled icons.** Lucide is outline-only — stay consistent.

### Semantic icon assignments (never change these)
| Icon | Meaning | Use |
|---|---|---|
| `Shield` | Zero-knowledge / privacy | Local Mode badge, vault unlock |
| `Lock` | Encrypted / secured | Encrypted file status |
| `Zap` | Red Zone | Red Zone badge, keyword flash |
| `BookOpen` | Study Guide | Study Guide upload, Anki |
| `Mic` | Recording / transcription | Audio input, Whisper progress |
| `FileText` | PDF / slides | Slide viewer, upload |
| `AlertTriangle` | Warning / high-friction | Onboarding warning modal |
| `Download` | Export / Recovery Kit | Recovery Key download, Anki export |
| `Layers` | Synthetic / Likely Zone | Synthetic Study Guide badge |

---

## 9. Key Screens — Layout Notes

### Onboarding / vault setup
- Full-page centered layout, max-width 440px
- Steps: OAuth → passphrase setup → high-friction warning → Recovery Kit download
- Progress indicator: 4 dots at top, no numbers
- Warning modal: `rose-900/20` background fill, `AlertTriangle` icon in `rose-400`, two checkboxes must be checked before "Continue" is enabled — button stays disabled and desaturated until both checked
- Recovery Kit display: `font-mono`, `bg-subtle`, `border-dashed border-border-default`, with `Download` button below — **"Open vault" button is disabled until download is confirmed**

### Session dashboard (vault home)
- Session cards: `bg-elevated`, `8px radius`, `border-default`
- Each card shows: session title (encrypted, decrypted on render), input badges (PDF/Audio/Guide), Red Zone count, Likely Zone count, storage size, last accessed
- Empty state: centered, `Layers` icon at 48px, `text-secondary` heading "Start your first session", two CTAs: "Upload files" (primary) + "Import Anki deck" (secondary)
- Vault size indicator: bottom of sidebar, `caption` text, thin progress bar, `text-tertiary`

### Session view (study mode)
- Three-pane layout (see §6)
- Top bar is always visible and sticky: session title (editable inline) | input status badges | Local Mode badge | processing status
- Bottom bar collapses when not in study mode, expands when Whisper/BERT is running
- Red Zone keywords list: horizontally scrollable chip row under the bottom bar

### Upload / ingestion view
- Drag-and-drop zone: full-width, `border-dashed border-2 border-border-strong`, `radius-8`, tall enough to be obvious (min 200px)
- Three drop zones in a row: PDF | Audio | Study Guide — each with its icon, accepted formats below, and a "or paste URL" input for audio
- Progress stack: vertical list of file processing steps, each with a progress bar and step label
- Adaptive unlock hints: after each file processes, show "Add [missing input] to unlock [feature]" in `amber-50` bg banner

### Recovery Kit modal
- `max-width: 480px`, `radius-12`, `shadow-lg`
- `AlertTriangle` icon in `rose-400` at 32px
- Copy: bold heading "We cannot recover your account", body explaining the consequence
- Key display: monospace box, copy-to-clipboard button
- Download button: primary indigo, full-width
- "I've saved my key in a safe place" checkbox — required before Continue appears
- Continue button: disabled + 30% opacity until checkbox checked

---

## 10. Tailwind Config Extension

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        indigo: { 50: '#EEF2FF', 100: '#E0E7FF', 200: '#C7D2FE', 300: '#A5B4FC', 400: '#818CF8', 500: '#6366F1', 600: '#4F46E5', 700: '#4338CA', 800: '#3730A3', 900: '#1E1B4B' },
        rose:   { 50: '#FFF1F2', 100: '#FFE4E6', 200: '#FDA4AF', 300: '#FB7185', 400: '#F43F5E', 500: '#E11D48', 600: '#BE123C', 900: '#4C0519' },
        violet: { 50: '#F5F3FF', 100: '#EDE9FE', 200: '#DDD6FE', 300: '#C4B5FD', 400: '#A78BFA', 500: '#8B5CF6', 600: '#7C3AED', 900: '#2E1065' },
        amber:  { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FCD34D', 300: '#F59E0B', 400: '#D97706' },
        bg: {
          base:     '#09090F',
          elevated: '#111118',
          overlay:  '#16151F',
          subtle:   '#1C1B28',
          input:    '#13121C',
        },
        border: {
          default: '#1E1E2E',
          subtle:  '#191827',
          strong:  '#2D2B45',
        },
        text: {
          primary:   '#E2E8F0',
          secondary: '#94A3B8',
          tertiary:  '#5B6478',
          inverse:   '#09090F',
        },
      },
      borderRadius: {
        'input': '2px',
        'btn':   '6px',
        'card':  '8px',
        'modal': '12px',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        'display':    ['28px', { lineHeight: '1.25', fontWeight: '500' }],
        'heading':    ['20px', { lineHeight: '1.3',  fontWeight: '500' }],
        'subheading': ['16px', { lineHeight: '1.4',  fontWeight: '500' }],
        'body':       ['14px', { lineHeight: '1.6',  fontWeight: '400' }],
        'body-sm':    ['13px', { lineHeight: '1.55', fontWeight: '400' }],
        'label':      ['12px', { lineHeight: '1.5',  fontWeight: '400' }],
        'caption':    ['11px', { lineHeight: '1.4',  fontWeight: '500' }],
        'mono-sm':    ['12px', { lineHeight: '1.6',  fontWeight: '400' }],
      },
      boxShadow: {
        'sm':     '0 1px 3px rgba(0,0,0,0.4)',
        'md':     '0 4px 16px rgba(0,0,0,0.5)',
        'lg':     '0 8px 32px rgba(0,0,0,0.6)',
        'indigo': '0 0 0 1px rgba(99,102,241,0.4)',
        'rose':   '0 0 0 1px rgba(244,63,94,0.4)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
```

---

## 11. globals.css Starter

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* All CSS custom properties from §2 go here */
    --font-sans: 'Inter', -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  * {
    border-color: #1E1E2E; /* border-default as the reset */
  }

  body {
    background-color: #09090F;
    color: #E2E8F0;
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Custom scrollbar — clinical, minimal */
  ::-webkit-scrollbar       { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1E1E2E; border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: #2D2B45; }

  /* Selection */
  ::selection { background: rgba(99,102,241,0.25); color: #E2E8F0; }

  /* Focus visible — only for keyboard nav */
  :focus-visible {
    outline: 1.5px solid #6366F1;
    outline-offset: 2px;
    border-radius: 4px;
  }

  /* Remove default focus for mouse users */
  :focus:not(:focus-visible) { outline: none; }
}
```

---

## 12. Prompting 21st.dev Magic Effectively

When using `/ui` with the Magic MCP, always include theme context. Use this template:

```
/ui [component description]

Theme context for Nocturne:
- Dark mode only. bg-base: #09090F, bg-elevated: #111118, border: #1E1E2E
- Primary accent: indigo #6366F1
- Text primary: #E2E8F0, text secondary: #94A3B8
- Border radius: cards=8px, buttons=6px, inputs=2px, badges=999px
- Font: Inter, 14px body, 11px ALL CAPS captions with 0.07em letter-spacing
- Clinical/productivity aesthetic — no gradients, no decorative shadows on cards
- Icons: Lucide React, stroke-width 1.5, outline only
- Tailwind CSS only — no inline styles
```

---

*Last updated: 2026-05-19 — Nocturne design system v1.1, indigo-led palette, dark mode only, Framer Motion included*
