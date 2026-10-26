// Browser-only. Helpers for writing, reading, and clearing crash-recovery
// checkpoints in IndexedDB.  Each recording gets one meta row and one chunk row
// per MediaRecorder timeslice.  Chunks are AES-GCM encrypted with the vault's
// master key — audio never sits in plaintext in IndexedDB.
//
// Typical lifecycle:
//   recording starts  → writeCheckpointMeta()      (one call)
//   every 5 s         → writeCheckpointChunk()     (one call per timeslice)
//   save succeeds     → clearCheckpoint()           (removes meta + all chunks)
//   save fails        → checkpoint retained; assembleCheckpoint() on next load

import { db, type RecordingChunk } from '@/lib/db/dexie'

// ── Crypto helpers ────────────────────────────────────────────────────────────

async function encryptBin(
  mk: CryptoKey,
  data: ArrayBuffer,
): Promise<{ ct: ArrayBuffer; ivB64: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, mk, data)
  const ivB64 = btoa(String.fromCharCode(...new Uint8Array(iv)))
  return { ct, ivB64 }
}

async function decryptBin(
  mk: CryptoKey,
  ct: ArrayBuffer,
  ivB64: string,
): Promise<ArrayBuffer> {
  const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, mk, ct)
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CheckpointMeta {
  fileId: string
  sessionId: string
  userId: string
  startedAt: number  // epoch ms — when MediaRecorder.start() was called
  mimeType: string
  chunkCount: number
}

/** Creates (or replaces) the meta row for a recording checkpoint. */
export async function writeCheckpointMeta(
  fileId: string,
  sessionId: string,
  userId: string,
  startedAt: number,
  mimeType: string,
): Promise<void> {
  await db.recordingChunkMeta.put({ fileId, sessionId, userId, startedAt, mimeType, chunkCount: 0 })
}

/**
 * Encrypts `data` and appends a chunk row.
 * The chunk id is deterministic (`${fileId}_${chunkIndex}`) — a retry write
 * for the same chunk safely overwrites rather than duplicating.
 * Throws `DOMException { name: 'QuotaExceededError' }` if the browser's
 * origin storage is full.
 */
export async function writeCheckpointChunk(
  fileId: string,
  chunkIndex: number,
  data: ArrayBuffer,
  mk: CryptoKey,
): Promise<void> {
  const { ct, ivB64 } = await encryptBin(mk, data)
  await db.recordingChunks.put({ id: `${fileId}_${chunkIndex}`, fileId, chunkIndex, ct, ivB64 })
  // Increment chunk count in meta; ignore if meta was already deleted (race on clear)
  const meta = await db.recordingChunkMeta.get(fileId)
  if (meta) {
    await db.recordingChunkMeta.update(fileId, { chunkCount: chunkIndex + 1 })
  }
}

/** Returns all checkpoint metas for `sessionId` that have at least one chunk. */
export async function listUnfinishedCheckpoints(sessionId: string): Promise<CheckpointMeta[]> {
  return db.recordingChunkMeta.where('sessionId').equals(sessionId).toArray()
}

/**
 * Decrypts and reassembles all chunks for `fileId` into a single Blob.
 * Returns null if no meta row exists.
 */
export async function assembleCheckpoint(fileId: string, mk: CryptoKey): Promise<Blob | null> {
  const meta = await db.recordingChunkMeta.get(fileId)
  if (!meta) return null

  const chunks: RecordingChunk[] = await db.recordingChunks.where('fileId').equals(fileId).sortBy('chunkIndex')
  if (chunks.length === 0) return null

  const plains = await Promise.all(chunks.map((c: RecordingChunk) => decryptBin(mk, c.ct, c.ivB64)))
  return new Blob(plains.map((p: ArrayBuffer) => new Uint8Array(p)), { type: meta.mimeType })
}

/** Removes the meta row and all chunk rows for `fileId`. */
export async function clearCheckpoint(fileId: string): Promise<void> {
  await db.recordingChunkMeta.delete(fileId)
  await db.recordingChunks.where('fileId').equals(fileId).delete()
}
