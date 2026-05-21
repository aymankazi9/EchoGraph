// Runs in a dedicated Web Worker — never on the main thread.
// Has access to SubtleCrypto, TextEncoder, atob/btoa via the worker global scope.

type InMsg =
  | { type: 'DERIVE_AND_WRAP'; passphrase: string; salt: string }
  | { type: 'DERIVE_AND_WRAP_WITH_RECOVERY'; passphrase: string; salt: string; recoverySalt: string }
  | { type: 'DERIVE_AND_UNWRAP'; passphrase: string; salt: string; wrappedKey: string }
  | { type: 'UNWRAP_WITH_RECOVERY'; recoveryWrappedKey: string; recoverySalt: string }
  // Passphrase change: unwraps MK with current KEK, re-wraps with new KEK — all inside the worker.
  | { type: 'CHANGE_PASSPHRASE'; currentPassphrase: string; currentSalt: string; currentWrappedKey: string; newPassphrase: string; newSalt: string }
  // Recovery re-derive: unwraps MK with vault KEK, re-wraps with recovery KEK.
  | { type: 'REDERIVE_RECOVERY'; passphrase: string; pbkdf2Salt: string; wrappedKey: string; recoverySalt: string }

type OutMsg =
  | { type: 'WRAP_DONE'; masterKey: CryptoKey; wrappedKeyB64: string }
  | { type: 'WRAP_WITH_RECOVERY_DONE'; masterKey: CryptoKey; wrappedKeyB64: string; recoveryWrappedKeyB64: string }
  | { type: 'UNWRAP_DONE'; masterKey: CryptoKey }
  | { type: 'CHANGE_PASSPHRASE_DONE'; newWrappedKeyB64: string }
  | { type: 'REDERIVE_RECOVERY_DONE'; recoveryWrappedKeyB64: string }
  | { type: 'ERROR'; message: string }

// Worker's postMessage has a different signature than Window.postMessage.
const send = (msg: OutMsg) =>
  (self as unknown as { postMessage(d: OutMsg): void }).postMessage(msg)

function b64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8.buffer
}

function bufferToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

async function deriveKEK(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  // 310,000 iterations per CONTEXT.md §2 key hierarchy
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBuffer(saltB64), iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  )
}

// Import 128-bit recovery salt directly as AES-128-KW key material. No PBKDF2 — the random salt IS the secret.
async function importRecoveryKEK(recoverySaltB64: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    b64ToBuffer(recoverySaltB64),
    { name: 'AES-KW', length: 128 },
    false,
    usages,
  )
}

self.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as InMsg

  try {
    if (msg.type === 'DERIVE_AND_WRAP') {
      const kek = await deriveKEK(msg.passphrase, msg.salt)

      // Generate with extractable:true so wrapKey can read it. Immediately wrapped below.
      const extractableMK = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      )

      const wrappedBuf = await crypto.subtle.wrapKey('raw', extractableMK, kek, { name: 'AES-KW' })
      const wrappedKeyB64 = bufferToB64(wrappedBuf)

      // Re-import as non-extractable. This is the key that goes to the main thread.
      const masterKey = await crypto.subtle.unwrapKey(
        'raw',
        wrappedBuf,
        kek,
        { name: 'AES-KW' },
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable — CONTEXT.md §10 rule 3
        ['encrypt', 'decrypt'],
      )

      // extractableMK and kek go out of scope here.
      send({ type: 'WRAP_DONE', masterKey, wrappedKeyB64 })
    }

    if (msg.type === 'DERIVE_AND_WRAP_WITH_RECOVERY') {
      // 1. Derive vault KEK via PBKDF2
      const kek = await deriveKEK(msg.passphrase, msg.salt)

      // 2. Generate extractable MK — needed for both wrapKey calls below
      const extractableMK = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt'],
      )

      // 3. Wrap MK with vault KEK
      const wrappedBuf = await crypto.subtle.wrapKey('raw', extractableMK, kek, { name: 'AES-KW' })
      const wrappedKeyB64 = bufferToB64(wrappedBuf)

      // 4. Import 128-bit recovery salt as AES-128-KW recovery KEK
      const recoveryKEK = await importRecoveryKEK(msg.recoverySalt, ['wrapKey'])

      // 5. Wrap MK with recovery KEK — this blob goes in the downloaded Recovery Kit
      const recoveryWrappedBuf = await crypto.subtle.wrapKey('raw', extractableMK, recoveryKEK, {
        name: 'AES-KW',
      })
      const recoveryWrappedKeyB64 = bufferToB64(recoveryWrappedBuf)

      // 6. Re-import MK as non-extractable — this is the only copy that leaves the worker
      const masterKey = await crypto.subtle.unwrapKey(
        'raw',
        wrappedBuf,
        kek,
        { name: 'AES-KW' },
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      )

      // All extractable copies (extractableMK, kek, recoveryKEK) go out of scope here.
      send({ type: 'WRAP_WITH_RECOVERY_DONE', masterKey, wrappedKeyB64, recoveryWrappedKeyB64 })
    }

    if (msg.type === 'DERIVE_AND_UNWRAP') {
      const kek = await deriveKEK(msg.passphrase, msg.salt)

      const masterKey = await crypto.subtle.unwrapKey(
        'raw',
        b64ToBuffer(msg.wrappedKey),
        kek,
        { name: 'AES-KW' },
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      )

      // kek goes out of scope here.
      send({ type: 'UNWRAP_DONE', masterKey })
    }

    if (msg.type === 'UNWRAP_WITH_RECOVERY') {
      // Import recovery salt as AES-128-KW recovery KEK
      const recoveryKEK = await importRecoveryKEK(msg.recoverySalt, ['unwrapKey'])

      const masterKey = await crypto.subtle.unwrapKey(
        'raw',
        b64ToBuffer(msg.recoveryWrappedKey),
        recoveryKEK,
        { name: 'AES-KW' },
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      )

      // recoveryKEK goes out of scope here.
      send({ type: 'UNWRAP_DONE', masterKey })
    }
    if (msg.type === 'CHANGE_PASSPHRASE') {
      // 1. Derive current KEK, unwrap MK as temporarily extractable inside the worker.
      const currentKEK = await deriveKEK(msg.currentPassphrase, msg.currentSalt)
      const extractableMK = await crypto.subtle.unwrapKey(
        'raw',
        b64ToBuffer(msg.currentWrappedKey),
        currentKEK,
        { name: 'AES-KW' },
        { name: 'AES-GCM', length: 256 },
        true, // temporarily extractable — stays inside the worker, never sent to main thread
        ['encrypt', 'decrypt'],
      )

      // 2. Derive new KEK, wrap MK with it.
      const newKEK = await deriveKEK(msg.newPassphrase, msg.newSalt)
      const newWrappedBuf = await crypto.subtle.wrapKey('raw', extractableMK, newKEK, { name: 'AES-KW' })
      // extractableMK and both KEKs go out of scope here.
      send({ type: 'CHANGE_PASSPHRASE_DONE', newWrappedKeyB64: bufferToB64(newWrappedBuf) })
    }

    if (msg.type === 'REDERIVE_RECOVERY') {
      // Unwrap MK with vault KEK (temporarily extractable), re-wrap with recovery KEK.
      const kek = await deriveKEK(msg.passphrase, msg.pbkdf2Salt)
      const extractableMK = await crypto.subtle.unwrapKey(
        'raw',
        b64ToBuffer(msg.wrappedKey),
        kek,
        { name: 'AES-KW' },
        { name: 'AES-GCM', length: 256 },
        true, // temporarily extractable inside worker only
        ['encrypt', 'decrypt'],
      )

      const recoveryKEK = await importRecoveryKEK(msg.recoverySalt, ['wrapKey'])
      const recoveryWrappedBuf = await crypto.subtle.wrapKey('raw', extractableMK, recoveryKEK, {
        name: 'AES-KW',
      })
      // extractableMK, kek, recoveryKEK all go out of scope here.
      send({ type: 'REDERIVE_RECOVERY_DONE', recoveryWrappedKeyB64: bufferToB64(recoveryWrappedBuf) })
    }
  } catch (e) {
    send({ type: 'ERROR', message: String(e) })
  }
})
