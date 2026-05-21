// Runs in a dedicated Web Worker — never on the main thread.
// Uses @ffmpeg/ffmpeg which internally creates its own worker for the WASM core (nested workers).
// Supported in Chrome 69+, Firefox 65+, Safari 15.4+.

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

type InMsg = { type: 'TRANSCODE'; file: ArrayBuffer; mimeType: string }

type OutMsg =
  | { type: 'PROGRESS'; pct: number; stage: 'loading' | 'transcoding' }
  | { type: 'DONE'; opus: ArrayBuffer }
  | { type: 'ERROR'; message: string }

const post = (msg: OutMsg, transfer?: Transferable[]) =>
  (self as unknown as { postMessage(d: OutMsg, t: Transferable[]): void }).postMessage(
    msg,
    transfer ?? [],
  )

// Single-threaded core — no SharedArrayBuffer / COOP-COEP headers required.
const CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd'

let ffmpeg: FFmpeg | null = null

async function loadFFmpeg(): Promise<void> {
  if (ffmpeg) return
  ffmpeg = new FFmpeg()
  await ffmpeg.load({
    coreURL: await toBlobURL(`${CDN}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CDN}/ffmpeg-core.wasm`, 'application/wasm'),
  })
}

function mimeToExt(mime: string): string {
  if (mime.includes('wav')) return '.wav'
  if (mime.includes('m4a') || mime.includes('mp4') || mime.includes('aac')) return '.m4a'
  if (mime.includes('mp3') || mime.includes('mpeg')) return '.mp3'
  if (mime.includes('ogg') || mime.includes('opus')) return '.ogg'
  if (mime.includes('webm')) return '.webm'
  if (mime.includes('flac')) return '.flac'
  return '.audio'
}

self.addEventListener('message', async (event: MessageEvent) => {
  const msg = event.data as InMsg
  if (msg.type !== 'TRANSCODE') return

  try {
    post({ type: 'PROGRESS', pct: 0, stage: 'loading' })
    await loadFFmpeg()

    // Wire up per-transcode progress — fired during exec()
    ffmpeg!.on('progress', ({ progress }) => {
      post({ type: 'PROGRESS', pct: Math.round(progress * 100), stage: 'transcoding' })
    })

    const inputName = `input${mimeToExt(msg.mimeType)}`
    await ffmpeg!.writeFile(inputName, new Uint8Array(msg.file))

    await ffmpeg!.exec([
      '-i', inputName,
      '-c:a', 'libopus',
      '-b:a', '64k',
      '-ac', '1',       // mono
      '-ar', '16000',   // 16 kHz — adequate for speech, small file
      '-vn',            // strip any video stream
      'output.opus',
    ])

    const raw = await ffmpeg!.readFile('output.opus')
    const bytes = raw as Uint8Array
    // slice() to detach from any shared backing buffer and return a plain ArrayBuffer
    const opus = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

    await ffmpeg!.deleteFile(inputName)
    await ffmpeg!.deleteFile('output.opus')

    post({ type: 'DONE', opus }, [opus])
  } catch (e) {
    post({ type: 'ERROR', message: String(e) })
  }
})
