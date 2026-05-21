// Browser + Worker — no server imports.
// TypeScript 5.7+ treats Uint8Array as Uint8Array<T extends ArrayBufferLike>.
// All functions that feed into SubtleCrypto (which requires ArrayBuffer-backed types)
// are explicitly typed with <ArrayBuffer> to satisfy the strict generic constraints.

export const CHUNK_SIZE = 64 * 1024 * 1024 // 64 MB

// Derive a per-chunk IV by XOR-ing the chunk index (little-endian 4 bytes)
// into bytes 0-3 of the base IV. Chunk 0 → IV == baseIV (XOR with 0).
// Per CONTEXT.md §2 IV safety rules.
export function deriveChunkIV(
  baseIV: Uint8Array<ArrayBufferLike>,
  chunkIndex: number,
): Uint8Array<ArrayBuffer> {
  // Create a fresh copy backed by a plain ArrayBuffer — required by SubtleCrypto
  const buf = new ArrayBuffer(12)
  const iv = new Uint8Array(buf) as Uint8Array<ArrayBuffer>
  for (let i = 0; i < 12; i++) iv[i] = baseIV[i]!
  iv[0] ^= (chunkIndex >>> 0) & 0xff
  iv[1] ^= (chunkIndex >>> 8) & 0xff
  iv[2] ^= (chunkIndex >>> 16) & 0xff
  iv[3] ^= (chunkIndex >>> 24) & 0xff
  return iv
}

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

// Encrypt data into the .bin format:
//   [12-byte baseIV][4-byte chunk count LE][per chunk: [4-byte ciphertext len LE][ciphertext]]
//
// A fresh random baseIV is generated per call — never reuse across files.
// chunkSize is configurable for testing (default 64 MB).
export async function encryptFile(
  masterKey: CryptoKey,
  data: ArrayBuffer,
  onProgress?: (pct: number) => void,
  chunkSize = CHUNK_SIZE,
): Promise<{ bin: ArrayBuffer; baseIV: Uint8Array<ArrayBuffer> }> {
  const baseIVBuf = new ArrayBuffer(12)
  const baseIV = crypto.getRandomValues(new Uint8Array(baseIVBuf)) as Uint8Array<ArrayBuffer>
  const chunkCount = Math.max(1, Math.ceil(data.byteLength / chunkSize))

  const ciphertexts: ArrayBuffer[] = []
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize
    // data.slice() returns a plain ArrayBuffer — compatible with SubtleCrypto.encrypt
    const slice = data.slice(start, start + chunkSize)
    const iv = deriveChunkIV(baseIV, i)
    ciphertexts.push(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, slice))
    onProgress?.(((i + 1) / chunkCount) * 100)
  }

  const totalSize = 12 + 4 + ciphertexts.reduce((s, ct) => s + 4 + ct.byteLength, 0)
  const bin = new ArrayBuffer(totalSize)
  const view = new DataView(bin)
  const u8 = new Uint8Array(bin)

  u8.set(baseIV, 0)
  view.setUint32(12, chunkCount, true)

  let offset = 16
  for (const ct of ciphertexts) {
    view.setUint32(offset, ct.byteLength, true)
    offset += 4
    u8.set(new Uint8Array(ct), offset)
    offset += ct.byteLength
  }

  return { bin, baseIV }
}

// Encrypt a short plaintext (filename, session title) with AES-GCM.
// Returns "ctB64:ivB64" — a single storable string.
export async function encryptText(masterKey: CryptoKey, plaintext: string): Promise<string> {
  const ivBuf = new ArrayBuffer(12)
  const iv = crypto.getRandomValues(new Uint8Array(ivBuf)) as Uint8Array<ArrayBuffer>
  // Use a fresh ArrayBuffer-backed copy so SubtleCrypto accepts it
  const encodedRaw = new TextEncoder().encode(plaintext)
  const plainBuf = new ArrayBuffer(encodedRaw.byteLength)
  new Uint8Array(plainBuf).set(encodedRaw)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, plainBuf)
  return `${bufToB64(ct)}:${bufToB64(ivBuf)}`
}
