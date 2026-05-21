// Runs in a dedicated Web Worker — never on the main thread.
// Receives a non-extractable CryptoKey via structured clone (valid per Web Crypto spec).

import { encryptFile } from '@/lib/crypto/encrypt'

type InMsg = { type: 'ENCRYPT'; data: ArrayBuffer; key: CryptoKey }

type OutMsg =
  | { type: 'PROGRESS'; pct: number }
  | { type: 'DONE'; bin: ArrayBuffer; baseIVB64: string }
  | { type: 'ERROR'; message: string }

const post = (msg: OutMsg, transfer?: Transferable[]) =>
  (self as unknown as { postMessage(d: OutMsg, t: Transferable[]): void }).postMessage(
    msg,
    transfer ?? [],
  )

self.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as InMsg
  if (msg.type !== 'ENCRYPT') return

  try {
    const { bin, baseIV } = await encryptFile(msg.key, msg.data, (pct) => {
      post({ type: 'PROGRESS', pct })
    })

    let b64 = ''
    for (let i = 0; i < baseIV.byteLength; i++) b64 += String.fromCharCode(baseIV[i])
    const baseIVB64 = btoa(b64)

    post({ type: 'DONE', bin, baseIVB64 }, [bin])
  } catch (e) {
    post({ type: 'ERROR', message: String(e) })
  }
})
