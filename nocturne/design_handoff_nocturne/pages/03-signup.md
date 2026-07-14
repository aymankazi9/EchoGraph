# Sign Up — Vault Setup

- **Design reference:** `reference/source/Sign Up.dc.html`
- **Target route:** `src/app/(vault)/setup/` (+ entry from `/login`)
- **Status:** Route exists (`(vault)/setup`); build the 4-step flow to match mock.
  Reuse `src/components/onboarding/onboarding-progress.tsx` and `recovery-modal.tsx`,
  and `src/lib/crypto/*` for real key derivation / recovery-kit generation.

## Purpose
Create an account AND set up the zero-knowledge vault: derive the encryption key from a
passphrase and save a Recovery Kit. This is security-critical — copy and warnings are ground truth.

## Layout — two-panel split
- **Left brand panel:** wordmark, eyebrow chip *"End-to-end encrypted setup"*, headline
  *"Set up your private vault."* (clamp 30→42px, tagline gradient on "private vault."), and a
  **vertical stepper** with 3 steps:
  1. Create account — "Sign in with Google or email"
  2. Set vault passphrase — "Derives your non-extractable key"
  3. Save Recovery Kit — "Your only backdoor-free backup"
- **Right form panel:** the active step (`data-step`).

## Steps (state machine: `isStep0..isStep3`)
**Step 0 — Create account.** `h2` "Create your account", sub "Start with the full core product —
free forever, no card." Google button + email field (`#13121C`, rose border on error,
`rounded-md` ~9px). Footer: "Already have an account? Sign in" → Login.

**Step 1 — Vault passphrase.** `h2` "Create your vault passphrase." Passphrase + confirm fields,
live **strength meter** (5 levels: colors `#FB7185,#FB7185,#FBBF24,#A78BFA,#2DD4BF`; labels
"Weak…/Fair…/Good…/Strong passphrase"). Mismatch helper in rose. **Critical warning box** (rose
tint, triangle icon): *"No password reset exists. There is no backdoor. If you forget this…"*.

**Step 2 — Recovery Kit.** `h2` "Save your Recovery Kit." A kit card (`#0D0D14`, `rounded-lg`)
with download action + copy. Explains it's the one backup; Nocturne can't store it.

**Step 3 — Ready.** Centered success: lock glyph, `h2` "Your vault is ready." (25px), reassurance
copy, full-width primary CTA → Vault Dashboard.

## Tokens
Auth-zone radii (9–11px), strength-meter colors above, rose warning tint
(`rgba(244,63,94,0.…)`), `[data-step]` transitions.

## Wiring
Drive real crypto: passphrase → PBKDF2 → Master Key (`src/lib/crypto/vault.ts`), Recovery Kit
generation (`src/lib/crypto/recovery.ts`). On finish, vault is unlocked → redirect to `/vault`.
