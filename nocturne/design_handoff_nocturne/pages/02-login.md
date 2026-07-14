# Login / Sign In

- **Design reference:** `reference/source/Login (Canvas).dc.html` (the file is named "Canvas"
  but it **is** the login page)
- **Target route:** `src/app/login/page.tsx`, and the vault-unlock step at `src/app/(vault)/unlock/`
- **Status:** Route exists; restyle to match mock.

## Purpose
Returning user signs in and unlocks their encrypted vault to continue studying.

## Layout — two-panel split (collapses to single column < 940px)
- **Left brand panel** (`[data-brand]`, hidden < 940px): dark, ambient. Wordmark, a headline,
  and the privacy/value reassurance: *"Unlock your encrypted vault and pick up exactly where the
  lecture left off — every keyword still ranked by how likely it is to be on the exam."* Includes
  a live-dot accent (`noct-livedot`).
- **Right form panel** (`[data-form]`, `border-left` divider; full-width < 940px with
  `[data-formbg]`): small wordmark/monogram, `h2` "Sign in" (24px/600/-0.02em), subcopy
  *"Continue to your vault to keep studying."*, then the auth controls.

## Components
- **Google sign-in button** (primary path) + email field fallback.
- **Vault passphrase unlock** — `passphrase-input` (component already exists at
  `src/components/ui/passphrase-input.tsx`) with show/hide toggle.
- Primary button (`[data-btn] [data-shine]`, `rounded-md` ~9px, indigo, near-black text).
- Footer link to Sign Up ("Don't have an account? Create one").

## Tokens
Auth-zone radii (8–9px), `[data-anim]` entrance (`noct-authin` translateY 16→0, .7s),
focus ring indigo, input bg `#13121C` → `#16151F` on focus.

## States
Idle · focused inputs · invalid credentials (rose helper text) · unlocking (loading) · locked-out.

## Privacy note
Reinforce that the passphrase derives the key locally and never leaves the device — same language
as Sign Up. There is no password reset / backdoor.
