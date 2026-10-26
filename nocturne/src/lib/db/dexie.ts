// @ts-nocheck — dexie 4.x types don't resolve cleanly under moduleResolution:bundler; runtime is correct
import Dexie from 'dexie'

// Local session record — mirrors the Supabase sessions row but stored for offline access.
export interface LocalSession {
  id: string
  userId: string
  titleEncrypted: string // "ctB64:ivB64"
  status: 'ingesting' | 'processing' | 'ready'
  hasSlides: boolean
  hasAudio: boolean
  hasStudyGuide: boolean
  createdAt: number // epoch ms
}

// Write-ahead buffer for uploads — written BEFORE Supabase upload begins.
// If the tab closes mid-upload, 'pending' rows remain and allow recovery.
export interface PendingUpload {
  id: string // fileId (uuid)
  sessionId: string
  fileType: 'pdf' | 'audio' | 'guide' | 'handwritten'
  storagePath: string // legacy: /{userId}/{sessionId}/{fileId}.bin  |  new: /{userId}/sources/{fileId}.bin
  sizeBytes: number // original plaintext byte count
  mimeHint: string // original MIME type
  ivB64: string // base64 base IV — duplicated in .bin header, stored for fast DB lookup
  filenameEncrypted: string // "ctB64:ivB64"
  status: 'pending' | 'uploading' | 'done' | 'error'
  binData?: ArrayBuffer // encrypted .bin; cleared after successful upload
  errorMessage?: string
  createdAt: number
}

// ── Crash-recovery checkpoint (version 2) ─────────────────────────────────────
//
// live-transcription.ts writes one meta row per recording and one chunk row per
// MediaRecorder timeslice.  Chunks are AES-GCM encrypted with the master key so
// audio never sits in plaintext in IndexedDB.  On the next session load,
// SessionClient checks for unfinished checkpoints and offers recovery.
//
// Lifecycle:
//   recording starts → writeCheckpointMeta → recordingChunkMeta row created
//   every 5s         → writeCheckpointChunk → recordingChunks row appended
//   save succeeds    → clearCheckpoint → both tables cleaned
//   save fails       → checkpoint retained for retry / in-app recovery

export interface RecordingChunkMeta {
  fileId: string    // PK — same as the session_files id used throughout the pipeline
  sessionId: string
  userId: string
  startedAt: number // epoch ms — when MediaRecorder.start() was called
  mimeType: string  // e.g. 'audio/webm;codecs=opus'
  chunkCount: number
}

export interface RecordingChunk {
  id: string        // "${fileId}_${chunkIndex}" — deterministic, avoids duplicates on retry
  fileId: string    // index — for bulk retrieval and delete
  chunkIndex: number
  ct: ArrayBuffer   // AES-GCM ciphertext
  ivB64: string     // base64 IV
}

class NocturneDB extends Dexie {
  localSessions!: Dexie.Table<LocalSession, string>
  pendingUploads!: Dexie.Table<PendingUpload, string>
  recordingChunkMeta!: Dexie.Table<RecordingChunkMeta, string>
  recordingChunks!: Dexie.Table<RecordingChunk, string>

  constructor() {
    super('nocturne-v1')
    this.version(1).stores({
      localSessions: 'id, userId, status',
      pendingUploads: 'id, sessionId, status',
    })
    // Version 2: crash-recovery checkpoint tables.
    // Existing v1 tables are unchanged — Dexie migrates automatically.
    this.version(2).stores({
      localSessions: 'id, userId, status',
      pendingUploads: 'id, sessionId, status',
      recordingChunkMeta: 'fileId, sessionId',
      recordingChunks: 'id, fileId',
    })
  }
}

export const db = new NocturneDB()
