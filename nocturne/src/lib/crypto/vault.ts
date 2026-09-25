// Browser-only module. Import only from 'use client' components.
// Never import from Server Components or Route Handlers.

import type { SupabaseClient } from '@supabase/supabase-js'

type WorkerInMsg =
  | { type: 'DERIVE_AND_WRAP'; passphrase: string; salt: string }
  | { type: 'DERIVE_AND_WRAP_WITH_RECOVERY'; passphrase: string; salt: string; recoverySalt: string }
  | { type: 'DERIVE_AND_UNWRAP'; passphrase: string; salt: string; wrappedKey: string }
  | { type: 'UNWRAP_WITH_RECOVERY'; recoveryWrappedKey: string; recoverySalt: string }
  | { type: 'CHANGE_PASSPHRASE'; currentPassphrase: string; currentSalt: string; currentWrappedKey: string; newPassphrase: string; newSalt: string }
  | { type: 'REDERIVE_RECOVERY'; passphrase: string; pbkdf2Salt: string; wrappedKey: string; recoverySalt: string }

type WorkerOutMsg =
  | { type: 'WRAP_DONE'; masterKey: CryptoKey; wrappedKeyB64: string }
  | { type: 'WRAP_WITH_RECOVERY_DONE'; masterKey: CryptoKey; wrappedKeyB64: string; recoveryWrappedKeyB64: string }
  | { type: 'UNWRAP_DONE'; masterKey: CryptoKey; ephemeralKeyB64: string; cachedWrappedMKB64: string }
  | { type: 'CHANGE_PASSPHRASE_DONE'; newWrappedKeyB64: string }
  | { type: 'REDERIVE_RECOVERY_DONE'; recoveryWrappedKeyB64: string }
  | { type: 'ERROR'; message: string }

// Module-scoped — persists for the lifetime of the page/tab.
// Cleared explicitly on logout. Never serialized or stored anywhere.
let _masterKey: CryptoKey | null = null
// Holds recovery blob between setup and backup pages (client-side navigation only).
let _pendingRecoveryBlob: string | null = null

// ── Session-scoped soft-unlock cache ──────────────────────────────────────────
// At unlock time we generate a random ephemeral AES-256-KW key, use it to wrap
// a second extractable copy of the master key, and store both in sessionStorage.
// On page reload (within the same browser tab/session), if the vault-warm cookie
// is still alive we can restore the MK from that cache without prompting for the
// passphrase again — skipping the /unlock redirect entirely.
//
// Security tradeoff (documented in docs/status/auth-middleware.md):
//   • The ephemeral key and wrapped blob are both in sessionStorage.  An attacker
//     with JS execution in the same origin can read both.  This is the same threat
//     model as the non-extractable in-memory MK (also reachable via same-origin
//     JS).  We accept the tradeoff for UX convenience within the ~1 h window.
//   • sessionStorage is cleared when the tab closes or the browser restarts —
//     the natural boundary we rely on rather than work around.
//   • On explicit logout or vault lock both entries are cleared immediately.
//   • Biometric unlock (WebAuthn/Touch ID/Windows Hello) is scoped as a future
//     replacement that closes this gap without sacrificing convenience.
const SS_EK     = 'nocturne-session-ek'   // ephemeral wrapping key, base64 raw
const SS_WMK    = 'nocturne-session-wmk'  // MK wrapped with ephemeral key, base64
const SS_EXP    = 'nocturne-session-exp'  // expiry Unix-ms timestamp string
const CACHE_TTL = 3_600_000               // 1 h — matches vault-warm max-age

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8.buffer
}

function sessionCacheWrite(ephemeralKeyB64: string, cachedWrappedMKB64: string): void {
  const expiry = Date.now() + CACHE_TTL
  sessionStorage.setItem(SS_EK,  ephemeralKeyB64)
  sessionStorage.setItem(SS_WMK, cachedWrappedMKB64)
  sessionStorage.setItem(SS_EXP, String(expiry))
}

function sessionCacheClear(): void {
  sessionStorage.removeItem(SS_EK)
  sessionStorage.removeItem(SS_WMK)
  sessionStorage.removeItem(SS_EXP)
}

// Attempts to restore the MK from the session cache without a passphrase prompt.
// Returns true and sets _masterKey if successful; returns false on any failure
// (expired cache, cleared sessionStorage, missing vault-warm cookie, crypto error).
// Call this before redirecting to /unlock on page load.
export async function vaultRestoreFromCache(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    // Cache is only valid while the vault-warm cookie is alive.
    if (!document.cookie.includes('nocturne-vault-warm=')) return false

    const ekB64  = sessionStorage.getItem(SS_EK)
    const wmkB64 = sessionStorage.getItem(SS_WMK)
    const expStr = sessionStorage.getItem(SS_EXP)
    if (!ekB64 || !wmkB64 || !expStr) return false

    if (Date.now() > parseInt(expStr, 10)) {
      sessionCacheClear()
      return false
    }

    const ephemeralKey = await crypto.subtle.importKey(
      'raw', b64ToBuffer(ekB64),
      { name: 'AES-KW', length: 256 },
      false,
      ['unwrapKey'],
    )

    const masterKey = await crypto.subtle.unwrapKey(
      'raw', b64ToBuffer(wmkB64), ephemeralKey,
      { name: 'AES-KW' },
      { name: 'AES-GCM', length: 256 },
      false,  // non-extractable — same guarantee as the passphrase unlock path
      ['encrypt', 'decrypt'],
    )

    _masterKey = masterKey
    console.log('[vault] MK restored from session cache (no passphrase required)')
    return true
  } catch {
    // Corrupted or tampered entries — clear and fall back to passphrase prompt.
    sessionCacheClear()
    return false
  }
}

export const getMasterKey = (): CryptoKey | null => _masterKey
export const isVaultUnlocked = (): boolean => _masterKey !== null
export const getPendingRecoveryBlob = (): string | null => _pendingRecoveryBlob
export const clearPendingRecoveryBlob = (): void => { _pendingRecoveryBlob = null }

function runWorker(msg: WorkerInMsg): Promise<WorkerOutMsg> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.ts', import.meta.url))

    worker.onmessage = (e: MessageEvent<WorkerOutMsg>) => {
      worker.terminate()
      if (e.data.type === 'ERROR') reject(new Error(e.data.message))
      else resolve(e.data)
    }

    worker.onerror = (e) => {
      worker.terminate()
      reject(new Error(e.message ?? 'Worker error'))
    }

    worker.postMessage(msg)
  })
}

// First-time setup: derive KEK, generate MK, wrap with both vault KEK and recovery KEK.
// Stores the non-extractable MK in module scope.
// Returns wrappedKeyB64 (write to Supabase) and recoveryWrappedKeyB64 (put in Recovery Kit download only).
export async function vaultSetup(
  passphrase: string,
  saltB64: string,
  recoverySaltB64: string,
): Promise<{ wrappedKeyB64: string; recoveryWrappedKeyB64: string }> {
  console.time('[vault] setup (PBKDF2 + keygen + wrap × 2)')
  const result = await runWorker({
    type: 'DERIVE_AND_WRAP_WITH_RECOVERY',
    passphrase,
    salt: saltB64,
    recoverySalt: recoverySaltB64,
  })
  console.timeEnd('[vault] setup (PBKDF2 + keygen + wrap × 2)')

  if (result.type !== 'WRAP_WITH_RECOVERY_DONE') throw new Error('Unexpected worker response')

  _masterKey = result.masterKey
  _pendingRecoveryBlob = result.recoveryWrappedKeyB64
  console.log('[vault] MK extractable:', result.masterKey.extractable) // will log false
  // Cookie set in backup page CTA — not here — so middleware blocks vault until user saves backup.

  return { wrappedKeyB64: result.wrappedKeyB64, recoveryWrappedKeyB64: result.recoveryWrappedKeyB64 }
}

// Returning login: derive KEK via PBKDF2, unwrap stored MK.
// Stores the non-extractable MK in module scope.
export async function vaultUnlock(
  passphrase: string,
  saltB64: string,
  wrappedKeyB64: string,
): Promise<void> {
  console.time('[vault] unlock (PBKDF2 + unwrap)')
  const result = await runWorker({
    type: 'DERIVE_AND_UNWRAP',
    passphrase,
    salt: saltB64,
    wrappedKey: wrappedKeyB64,
  })
  console.timeEnd('[vault] unlock (PBKDF2 + unwrap)')

  if (result.type !== 'UNWRAP_DONE') throw new Error('Unexpected worker response')

  _masterKey = result.masterKey
  console.log('[vault] MK extractable:', result.masterKey.extractable) // will log false
  document.cookie = 'nocturne-vault-warm=1; max-age=3600; path=/; SameSite=Strict'
  sessionCacheWrite(result.ephemeralKeyB64, result.cachedWrappedMKB64)
}

// Recovery unlock: import recovery salt as AES-128-KW key, unwrap recovery-wrapped MK.
// Stores the non-extractable MK in module scope.
export async function vaultUnlockWithRecovery(
  recoveryWrappedKeyB64: string,
  recoverySaltB64: string,
): Promise<void> {
  console.time('[vault] recovery unlock (import recovery KEK + unwrap)')
  const result = await runWorker({
    type: 'UNWRAP_WITH_RECOVERY',
    recoveryWrappedKey: recoveryWrappedKeyB64,
    recoverySalt: recoverySaltB64,
  })
  console.timeEnd('[vault] recovery unlock (import recovery KEK + unwrap)')

  if (result.type !== 'UNWRAP_DONE') throw new Error('Unexpected worker response')

  _masterKey = result.masterKey
  console.log('[vault] MK extractable (recovery path):', result.masterKey.extractable) // will log false
  document.cookie = 'nocturne-vault-warm=1; max-age=3600; path=/; SameSite=Strict'
  sessionCacheWrite(result.ephemeralKeyB64, result.cachedWrappedMKB64)
}

// Passphrase change: re-wraps the in-storage MK with a new KEK derived from new passphrase + new salt.
// The in-memory MK (_masterKey) is unchanged — no re-login required.
// Returns the new wrapped key blob to persist in Supabase.
export async function vaultChangePassphrase(
  currentPassphrase: string,
  currentSalt: string,
  currentWrappedKey: string,
  newPassphrase: string,
  newSalt: string,
): Promise<{ newWrappedKeyB64: string }> {
  const result = await runWorker({
    type: 'CHANGE_PASSPHRASE',
    currentPassphrase,
    currentSalt,
    currentWrappedKey,
    newPassphrase,
    newSalt,
  })
  if (result.type !== 'CHANGE_PASSPHRASE_DONE') throw new Error('Unexpected worker response')
  return { newWrappedKeyB64: result.newWrappedKeyB64 }
}

// Recovery key re-derivation: unlocks MK from DB blob, re-wraps with recovery KEK.
// Returns the recovery-wrapped key b64 for use with formatRecoveryKit().
export async function vaultRederiveRecovery(
  passphrase: string,
  pbkdf2Salt: string,
  wrappedKey: string,
  recoverySalt: string,
): Promise<string> {
  const result = await runWorker({
    type: 'REDERIVE_RECOVERY',
    passphrase,
    pbkdf2Salt,
    wrappedKey,
    recoverySalt,
  })
  if (result.type !== 'REDERIVE_RECOVERY_DONE') throw new Error('Unexpected worker response')
  return result.recoveryWrappedKeyB64
}

// Logout: clear MK FIRST, then end the Supabase session.
// Order is non-negotiable — CONTEXT.md §10 rule 7.
// Also clears the session cache so the soft-unlock entries cannot outlive
// an explicit logout or manual vault lock.
export async function vaultLogout(supabase: SupabaseClient): Promise<void> {
  _masterKey = null
  sessionCacheClear()
  document.cookie = 'nocturne-vault-warm=; max-age=0; path=/; SameSite=Strict'
  await supabase.auth.signOut()
}
