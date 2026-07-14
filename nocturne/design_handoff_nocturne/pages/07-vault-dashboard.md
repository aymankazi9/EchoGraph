# Vault Dashboard

- **Design reference:** `reference/source/Vault Dashboard.dc.html`
- **Target route:** `src/app/(app)/vault/` + `src/components/dashboard/*` and `src/components/nav/*`
- **Status:** Route + components exist (`vault-dashboard-client.tsx`, `session-card.tsx`,
  `empty-state.tsx`, `filter-chips.tsx`, `sort-control.tsx`, `vault-search.tsx`,
  `app-shell.tsx`, `side-nav.tsx`, etc.). **Restyle to match the mock and add the new pieces
  below.** This is a multi-view client driven by a `view` state.

## App shell (persistent — `app-shell.tsx` + `side-nav.tsx`)
Left **sidebar** (224px expanded / 64px collapsed, `bg-rail`, right hairline, width spring
`.22s cubic-bezier(.4,0,.2,1)`; collapse persisted in `localStorage['nocturne-nav-collapsed']`).
Nav items (`height:38px`, `rounded-md` 9px, active = `rgba(99,102,241,0.13)` bg + `#C7CEF5`):
**Vault · Momentum · Community · New session · Help · Billing · Settings**.
> The mock added **Momentum** and **Community** to `NAV_ITEMS` — update `side-nav.tsx` to include
> them (icons `Flame`/`Zap` and `Users`). Bottom: `PrivacyBadge` ("Zero-knowledge encrypted"),
> `StorageIndicator`, `UserRow` (email + plan).

## Views (state machine inside `vault-dashboard-client.tsx`)
**1. Vault (populated)** — `h1` "Your vault" (27px) + subtitle. **NEW: ambient momentum ribbon**
(see below). Resume card (indigo wash, `rounded-2xl`). Stats row (3 cards, 25px mono values).
Session list — `session-card.tsx`: title (19px), subject · **Red Zone keyword count** (rose) ·
slide count, a mastery/progress bar, inline rename, last-opened. Filter chips + sort + search.

**2. Empty vault** — centered, upload glyph, `h2` "Your vault is empty" (21px), copy, upload CTAs.

**3. New session** — `h1` "New session", drop zone (`drop-zone.tsx`), file tiles for
PDF / audio / study-guide, contextual hint (`nsHint`) explaining what each unlock enables
(transcript sync, Red Zone scoring, heatmap…). Start button gated on files present.

**4. Help** — FAQ accordion (`helpDefs`: vault passphrase, Recovery Kit, Red Zone…). May redirect
to `/help` instead of an in-app view — your call.

**5. Settings** — account, preferences, security, storage, danger-zone (components already exist
under `src/components/settings/`).

**6. Billing** — plan card (32px price), tier comparison cards (26px price), change-plan flow with
a pending-rate confirmation row. Keep in sync with landing pricing.

### NEW — Ambient momentum ribbon (add to the Vault view)
A clickable row above the resume card linking to `/momentum`. Amber-tinted gradient
(`rounded-xl` 14px, border `rgba(251,191,36,0.22)`), contents: flame icon-chip + "12-day study
streak · best 21" + "Biochemistry is 86% exam-ready", a 7-square week strip (5 filled amber
gradient chips + 2 dashed), momentum balance (`1,240`, mono amber), "Open Momentum →". Hover
brightens border. This is the ambient half of the gamification system — see `pages/09-momentum.md`.

## Tokens
App-zone radii (cards 16px / hero 14–18px), surface ladder, indigo active-nav, rose Red Zone,
amber momentum.
