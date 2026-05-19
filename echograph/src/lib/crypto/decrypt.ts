// Browser-only — never import from server components or route handlers.

import { deriveChunkIV } from '@/lib/crypto/encrypt'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer as ArrayBuffer
}

// ─── Chunk decryption ─────────────────────────────────────────────────────────

// Decrypt a .bin produced by encryptFile().
// Format: [12-byte baseIV][4-byte chunkCount LE][per chunk: [4-byte ctLen LE][ciphertext]]
export async function decryptBin(
  bin: ArrayBuffer,
  masterKey: CryptoKey,
  onProgress?: (pct: number) => void,
): Promise<ArrayBuffer> {
  const view = new DataView(bin)

  // Read baseIV from the header (bytes 0–11)
  const baseIV = new Uint8Array(bin.slice(0, 12))
  const chunkCount = view.getUint32(12, true) // bytes 12–15

  const plaintexts: ArrayBuffer[] = []
  let offset = 16

  for (let i = 0; i < chunkCount; i++) {
    const ctLen = view.getUint32(offset, true)
    offset += 4
    const ciphertext = bin.slice(offset, offset + ctLen)
    offset += ctLen

    const iv = deriveChunkIV(baseIV, i)
    plaintexts.push(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ciphertext))
    onProgress?.(((i + 1) / chunkCount) * 100)
  }

  // Concatenate all plaintext chunks into a single ArrayBuffer
  const totalLen = plaintexts.reduce((s, p) => s + p.byteLength, 0)
  const out = new Uint8Array(totalLen)
  let pos = 0
  for (const p of plaintexts) {
    out.set(new Uint8Array(p), pos)
    pos += p.byteLength
  }
  return out.buffer as ArrayBuffer
}

// ─── Fetch + decrypt ──────────────────────────────────────────────────────────

// Fetch a .bin from Supabase Storage (signed URL) and decrypt it.
// Reports two phases: 'fetch' (0-100) and 'decrypt' (0-100).
export async function fetchAndDecryptFile(
  supabase: SupabaseClient,
  storagePath: string,
  masterKey: CryptoKey,
  onProgress?: (phase: 'fetch' | 'decrypt', pct: number) => void,
): Promise<ArrayBuffer> {
  const { data: signed, error } = await supabase.storage
    .from('echograph-files')
    .createSignedUrl(storagePath, 3600)

  if (error || !signed) throw new Error(error?.message ?? 'Failed to get signed URL')

  const bin = await new Promise<ArrayBuffer>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', signed.signedUrl, true)
    xhr.responseType = 'arraybuffer'

    xhr.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.('fetch', (e.loaded / e.total) * 100)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.('fetch', 100)
        resolve(xhr.response as ArrayBuffer)
      } else {
        reject(new Error(`Fetch failed: HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during fetch'))
    xhr.send()
  })

  return decryptBin(bin, masterKey, (pct) => onProgress?.('decrypt', pct))
}

// ─── Text decryption ──────────────────────────────────────────────────────────

// Decrypt a short ciphertext produced by encryptText(): "ctB64:ivB64"
export async function decryptText(masterKey: CryptoKey, ciphertext: string): Promise<string> {
  const colon = ciphertext.indexOf(':')
  if (colon === -1) throw new Error('Invalid ciphertext format')

  const ct = b64ToBuf(ciphertext.slice(0, colon))
  const iv = new Uint8Array(b64ToBuf(ciphertext.slice(colon + 1)))

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ct)
  return new TextDecoder().decode(plainBuf)
}
