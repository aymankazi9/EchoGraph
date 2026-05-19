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
  | { type: 'UNWRAP_DONE'; masterKey: CryptoKey }
  | { type: 'CHANGE_PASSPHRASE_DONE'; newWrappedKeyB64: string }
  | { type: 'REDERIVE_RECOVERY_DONE'; recoveryWrappedKeyB64: string }
  | { type: 'ERROR'; message: string }

// Module-scoped — persists for the lifetime of the page/tab.
// Cleared explicitly on logout. Never serialized or stored anywhere.
let _masterKey: CryptoKey | null = null

export const getMasterKey = (): CryptoKey | null => _masterKey
export const isVaultUnlocked = (): boolean => _masterKey !== null

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
  console.log('[vault] MK extractable:', result.masterKey.extractable) // will log false
  document.cookie = 'echograph-vault-warm=1; max-age=3600; path=/; SameSite=Strict'

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
  document.cookie = 'echograph-vault-warm=1; max-age=3600; path=/; SameSite=Strict'
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
  document.cookie = 'echograph-vault-warm=1; max-age=3600; path=/; SameSite=Strict'
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
export async function vaultLogout(supabase: SupabaseClient): Promise<void> {
  _masterKey = null
  document.cookie = 'echograph-vault-warm=; max-age=0; path=/; SameSite=Strict'
  await supabase.auth.signOut()
}
