## Status

| Sub-feature | Status |
|---|---|
| Supabase SSR auth (cookie refresh in middleware) | Done |
| PKCE OAuth callback (`/auth/callback`) | Done |
| `await cookies()` fix eliminating "code verifier not found" | Done |
| Auth-gated redirect (unauthenticated → `/login`) | Done |
| Vault-warm cookie guard (`nocturne-vault-warm`) | Done |
| Vault-warm redirect (authenticated but not unlocked → `/unlock?next=…`) | Done |
| Safe `next` param validation (vault/session paths only) | Done |
| Vault setup flow (3-step: account → passphrase → recovery kit) | Done |
| PBKDF2-SHA256 key derivation (310,000 iterations, in Web Worker) | Done |
| AES-256-GCM master key generation + AES-128-KW wrap | Done |
| Recovery key wrap (separate AES-128-KW key from `recovery_salt`) | Done |
| Recovery kit download (formatted blob) | Done |
| Recovery kit unlock flow (RecoveryForm) | Done |
| Vault unlock flow (passphrase → PBKDF2 → unwrap MK) | Done |
| In-memory master key storage (non-extractable CryptoKey, module scope) | Done |
| Session-scoped soft-unlock cache (sessionStorage wrapped MK, reload without passphrase) | Done |
| Vault logout (clear MK + session cache first, then supabase.signOut) | Done |
| Change passphrase (re-wrap MK with new KEK, no re-login) | Done |
| Recovery key re-derivation (for settings security section) | Done |
| Google OAuth sign-in | Done |
| Email magic link sign-in | Needs verification |
| Vault-warm cookie max-age (1 hour) | Done |
| Middleware route matcher | Done |

## What Exists

- `nocturne/src/middleware.ts` — Supabase SSR session refresh on every matched request; redirects unauthenticated users to `/login`; checks `nocturne-vault-warm` cookie and redirects to `/unlock?next=…` for authenticated users whose vault is not warm; bypasses `/login`, `/auth/callback`, `/setup`, `/unlock`; matcher covers `/vault/:path*`, `/session/:path*`, `/momentum/:path*`, `/community/:path*`, `/billing/:path*`
- `nocturne/src/app/auth/callback/route.ts` — PKCE code exchange: `await cookies()` (async, required for Next.js App Router), `exchangeCodeForSession(code)`, checks `users.pbkdf2_salt` to route new users to `/setup` and returning users to `/unlock`
- `nocturne/src/app/(vault)/setup/SetupForm.tsx` — 3-step setup wizard: step 0 (Google OAuth or email entry), step 1 (passphrase + strength meter + PBKDF2 hint), step 2 (recovery kit download + checkbox gate); derives key via `vaultSetup()`, saves `pbkdf2_salt`, `encrypted_master_key`, `recovery_salt` to `users` table; sets vault-warm cookie only after recovery kit is saved
- `nocturne/src/app/(vault)/setup/backup/BackupClient.tsx` — standalone backup page
- `nocturne/src/app/(vault)/unlock/UnlockForm.tsx` — passphrase entry form with animated progress bar during PBKDF2; dispatches to `vaultUnlock()`; shows `RecoveryForm` if `recoverySalt` is present
- `nocturne/src/app/(vault)/unlock/RecoveryForm.tsx` — recovery kit entry form; calls `vaultUnlockWithRecovery()`
- `nocturne/src/lib/crypto/vault.ts` — client-only module: `vaultSetup`, `vaultUnlock`, `vaultUnlockWithRecovery`, `vaultChangePassphrase`, `vaultRederiveRecovery`, `vaultLogout`, `vaultRestoreFromCache`; stores non-extractable `CryptoKey` in module-scoped `_masterKey`; all heavy crypto offloaded to a dedicated Web Worker; session-scoped soft-unlock cache written to sessionStorage at unlock time and cleared on logout
- `nocturne/src/lib/crypto/worker.ts` — Web Worker for PBKDF2 + AES-GCM key operations (DERIVE_AND_WRAP, DERIVE_AND_WRAP_WITH_RECOVERY, DERIVE_AND_UNWRAP, UNWRAP_WITH_RECOVERY, CHANGE_PASSPHRASE, REDERIVE_RECOVERY)
- `nocturne/src/lib/crypto/encrypt.ts` — `encryptText(masterKey, plaintext)` → `"ctB64:ivB64"` string
- `nocturne/src/lib/crypto/decrypt.ts` — `decryptText(masterKey, "ctB64:ivB64")` → plaintext
- `nocturne/src/lib/crypto/recovery.ts` — `downloadRecoveryKit(blob)`, `formatRecoveryKit(blob)` helpers
- `nocturne/src/lib/crypto/__tests__/chunkEncrypt.test.ts` — unit tests for chunk encryption
- `nocturne/src/components/settings/change-passphrase-modal.tsx` — modal that calls `vaultChangePassphrase()` and updates `users.encrypted_master_key`
- `nocturne/src/components/settings/security-section.tsx` — security settings panel including passphrase change and recovery key re-derivation
- `nocturne/src/components/onboarding/recovery-modal.tsx` — post-setup recovery kit reminder
- `nocturne/supabase/migrations/001_add_recovery_salt.sql` — adds `recovery_salt` column to `users`

## Session-scoped soft-unlock cache

At unlock time the Web Worker produces two extra values alongside the usual non-extractable `CryptoKey`: a random **ephemeral AES-256-KW key** (exportable) and the **MK wrapped with that key**.  Both are base64-encoded and written to `sessionStorage` under `nocturne-session-ek` / `nocturne-session-wmk`, tagged with an expiry timestamp (`nocturne-session-exp`) matching the vault-warm cookie's 1-hour lifetime.

On any page load where `_masterKey` is null (every reload, since the JS module re-initialises): each vault-guarded client component calls `vaultRestoreFromCache()` before deciding to redirect to `/unlock`.  If the vault-warm cookie is still present **and** the sessionStorage entries exist **and** the expiry hasn't passed, the cached MK is unwrapped directly into memory (non-extractable, same guarantee as the passphrase path) and the component proceeds normally — the user never sees the unlock screen.

**Boundaries that make this safe:**
- `sessionStorage` is cleared automatically when the tab closes or the browser restarts.  A new tab or a fresh browser session will never see the cache, so those paths still require passphrase entry.
- If the vault-warm cookie has expired (> 1 h), `vaultRestoreFromCache()` returns false immediately and the normal unlock flow runs.
- On explicit logout or manual vault lock, `sessionCacheClear()` removes all three sessionStorage entries synchronously before `signOut()` is called.

**Deliberate tradeoff vs. pure memory-only model:**  
The ephemeral key and wrapped blob both live in sessionStorage, which is reachable by any same-origin JavaScript — the same threat model as `_masterKey` itself (also reachable by same-origin JS via module-scope access).  The cache does not widen the attack surface beyond what was already true; it trades an absolute "passphrase required on every reload" property for convenience within the ~1-hour window.

**Future replacement:** WebAuthn/Touch ID/Windows Hello (biometric unlock) is the correct long-term answer — it binds the MK to a hardware-backed credential so the soft-cache is no longer needed.  Biometric unlock is explicitly scoped as a future feature and would close this gap without sacrificing convenience.

## What's Missing

- **Vault-warm cookie expires in 1 hour** — `max-age=3600`. The session cache also expires at the same time, so reloads after the 1-hour window still require passphrase re-entry. There is no automatic refresh mechanism for the vault-warm cookie while the tab is active.
- **Email magic-link flow is partially implemented** — SetupForm step 0 collects an email but only advances to step 1 (passphrase); it does not send a magic link via Supabase. The actual email auth path through Supabase Auth is not called from this UI. The `handleGoogleSignIn` path is fully working; the email path appears to be a stub.
- **No passphrase re-entry guard on sensitive settings** — the danger zone (account deletion, passphrase change) does not require the user to re-enter their passphrase before proceeding.

## Recent Decisions

- 2026-09-24: Session-scoped soft-unlock cache added. Worker produces ephemeral AES-256-KW key + wrapped MK copy on every `DERIVE_AND_UNWRAP` / `UNWRAP_WITH_RECOVERY` call. `vault.ts` stores both in sessionStorage at unlock time and clears them on logout. `VaultDashboardClient`, `SessionClient`, `NewSessionClient` all try `vaultRestoreFromCache()` before the `/unlock` redirect, so reloads within the 1-hour vault-warm window skip the passphrase prompt entirely. Biometric unlock (WebAuthn) scoped as future replacement.
- 2026-09-22: Beta invite code gate added to `SetupForm.tsx`. When `NEXT_PUBLIC_BETA_MODE=true`, a pre-setup invite code wall is shown before the main wizard. The validated flag is stored as `'nocturne-invite-ok'` in localStorage so it survives the Google OAuth redirect. The actual code is validated server-side via `'use server'` action `validateInviteCode()` (in `src/app/actions/validate-invite.ts`) — the invite code itself never leaves the server. When `BETA_MODE=false`, the wall disappears automatically with no other changes required.
- 2026-07-24: Auth PKCE bug fixed — `callback/route.ts` switched from synchronous to `await cookies()` from `next/headers`, eliminating "code verifier not found" on first OAuth attempt.

## Tier

Auth and vault setup are tier-agnostic — all authenticated users go through the same flow regardless of plan.
