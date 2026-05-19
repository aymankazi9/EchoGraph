import { describe, it, expect } from 'vitest'
import { deriveChunkIV, encryptFile } from '../encrypt'

// Node.js 19+ has globalThis.crypto with SubtleCrypto.
const subtle = globalThis.crypto.subtle

async function makeKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

describe('deriveChunkIV', () => {
  it('chunk 0 IV equals the base IV (XOR with 0 is identity)', () => {
    const base = crypto.getRandomValues(new Uint8Array(12))
    const iv0 = deriveChunkIV(base, 0)
    expect(Array.from(iv0)).toEqual(Array.from(base))
  })

  it('chunk 1 IV differs from base IV in exactly byte 0', () => {
    const base = new Uint8Array(12).fill(0)
    const iv1 = deriveChunkIV(base, 1)
    expect(iv1[0]).toBe(1)          // 0 XOR 1 = 1
    expect(Array.from(iv1.slice(1))).toEqual(Array.from(base.slice(1)))
  })

  it('does not mutate the base IV', () => {
    const base = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    const copy = new Uint8Array(base)
    deriveChunkIV(base, 42)
    expect(Array.from(base)).toEqual(Array.from(copy))
  })

  it('100 consecutive chunk IVs from the same base are all unique', () => {
    const base = crypto.getRandomValues(new Uint8Array(12))
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const key = Array.from(deriveChunkIV(base, i)).join(',')
      expect(seen.has(key), `chunk ${i} collides with a prior chunk`).toBe(false)
      seen.add(key)
    }
  })
})

describe('encryptFile — IV safety', () => {
  it('produces unique IVs for every chunk within one file', async () => {
    const key = await makeKey()
    // 500 bytes with 100-byte chunk size → 5 chunks
    const data = crypto.getRandomValues(new Uint8Array(500))

    const { bin, baseIV } = await encryptFile(key, data.buffer, undefined, 100)

    const view = new DataView(bin)
    const chunkCount = view.getUint32(12, true)
    expect(chunkCount).toBe(5)

    const ivs = new Set<string>()
    for (let i = 0; i < chunkCount; i++) {
      const iv = Array.from(deriveChunkIV(baseIV, i)).join(',')
      expect(ivs.has(iv), `chunk ${i} shares IV`).toBe(false)
      ivs.add(iv)
    }
  })

  it('two separate files get different base IVs', async () => {
    const key = await makeKey()
    const data = new Uint8Array(32).fill(0xab)

    const { baseIV: iv1 } = await encryptFile(key, data.buffer, undefined, 64)
    const { baseIV: iv2 } = await encryptFile(key, data.buffer, undefined, 64)

    // 1/2^96 probability of collision — effectively impossible
    expect(Array.from(iv1).join(',')).not.toBe(Array.from(iv2).join(','))
  })

  it('.bin header is well-formed', async () => {
    const key = await makeKey()
    const data = new Uint8Array(250)

    const { bin } = await encryptFile(key, data.buffer, undefined, 100)
    const view = new DataView(bin)

    // Bytes 12-15: chunk count (3 chunks for 250 bytes at 100/chunk)
    expect(view.getUint32(12, true)).toBe(3)

    // First chunk ciphertext length: 100 plaintext + 16 GCM tag = 116
    const firstCtLen = view.getUint32(16, true)
    expect(firstCtLen).toBe(116)
  })
})
