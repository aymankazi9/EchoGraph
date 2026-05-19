import Dexie, { type Table } from 'dexie'

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
  fileType: 'pdf' | 'audio' | 'guide'
  storagePath: string // /{userId}/{sessionId}/{fileId}.bin
  sizeBytes: number // original plaintext byte count
  mimeHint: string // original MIME type
  ivB64: string // base64 base IV — duplicated in .bin header, stored for fast DB lookup
  filenameEncrypted: string // "ctB64:ivB64"
  status: 'pending' | 'uploading' | 'done' | 'error'
  binData?: ArrayBuffer // encrypted .bin; cleared after successful upload
  errorMessage?: string
  createdAt: number
}

class EchoGraphDB extends Dexie {
  localSessions!: Table<LocalSession, string>
  pendingUploads!: Table<PendingUpload, string>

  constructor() {
    super('echograph-v1')
    this.version(1).stores({
      localSessions: 'id, userId, status',
      pendingUploads: 'id, sessionId, status',
    })
  }
}

export const db = new EchoGraphDB()
