'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { isVaultUnlocked } from '@/lib/crypto/vault'
import { createClient } from '@/lib/supabase'
import { ingestFiles, type FileProgress, type FileType, type IngestionFile } from '@/lib/upload'
import { DropZone } from '@/components/ingestion/drop-zone'
import { ProgressStack } from '@/components/ingestion/progress-stack'
import { UrlInput } from '@/components/ingestion/url-input'
import { db, type LocalSession } from '@/lib/db/dexie'

interface Props {
  userId: string
}

type Phase = 'idle' | 'processing' | 'done' | 'error'

// Variants from DESIGN_SYSTEM.md §7
const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

function PrivacyStatus({ mode }: { mode: 'local' | 'syncing' }) {
  return (
    <div className="flex items-center gap-2 text-label">
      <span
        className={[
          'w-2 h-2 rounded-full',
          mode === 'local' ? 'bg-indigo-500 animate-pulse-slow' : 'bg-amber-200',
        ].join(' ')}
      />
      <span className={mode === 'local' ? 'text-local-text' : 'text-amber-200'}>
        {mode === 'local' ? 'Local Mode' : 'Syncing'}
      </span>
    </div>
  )
}

export function NewSessionClient({ userId }: Props) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<FileType, File>>>({})
  const [progress, setProgress] = useState<FileProgress[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [privacyMode, setPrivacyMode] = useState<'local' | 'syncing'>('local')
  const sessionIdRef = useRef(crypto.randomUUID())

  // Vault guard
  useEffect(() => {
    if (!isVaultUnlocked()) router.replace('/unlock')
  }, [router])

  // Check for unfinished sessions from a prior tab close
  useEffect(() => {
    db.localSessions
      .where('userId').equals(userId)
      .and((s: LocalSession) => s.status === 'ingesting')
      .count()
      .then(setPendingCount)
  }, [userId])

  function handleFileSelect(type: FileType, file: File) {
    setSelectedFiles((prev) => ({ ...prev, [type]: file }))
  }

  function handleUrlFetched(data: ArrayBuffer, filename: string, mimeType: string) {
    // Treat URL-fetched audio as a File-like IngestionFile — wrapped into a synthetic File
    const blob = new Blob([data], { type: mimeType })
    const file = new File([blob], filename, { type: mimeType })
    setSelectedFiles((prev) => ({ ...prev, audio: file }))
  }

  async function handleStartIngestion() {
    const entries = Object.entries(selectedFiles) as [FileType, File][]
    if (entries.length === 0) return

    setError(null)
    setPhase('processing')
    setPrivacyMode('local')
    sessionIdRef.current = crypto.randomUUID()

    // Read all file data upfront
    const ingestionFiles: IngestionFile[] = await Promise.all(
      entries.map(async ([type, file]) => ({
        data: await file.arrayBuffer(),
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        type,
        sizeBytes: file.size,
      })),
    )

    const supabase = createClient()

    try {
      await ingestFiles(supabase, ingestionFiles, userId, sessionIdRef.current, (fp) => {
        setProgress(fp)
        // Switch to Syncing when any file reaches the upload step
        const anyUploading = fp.some((f) =>
          f.steps.some(
            (s) => s.label === 'Uploading' && (s.status === 'active' || s.status === 'done'),
          ),
        )
        setPrivacyMode(anyUploading ? 'syncing' : 'local')
      })
      setPhase('done')
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Ingestion failed. Check the steps below.')
    }
  }

  const hasFiles = Object.keys(selectedFiles).length > 0
  const busy = phase === 'processing'

  return (
    <div className="flex flex-col gap-8">
      {/* Header + privacy status */}
      <div className="flex items-start justify-between gap-4">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col gap-1.5">
          <h1 className="text-display font-medium text-text-primary">New session</h1>
          <p className="text-body text-text-secondary">
            Drop your files below. Processing happens locally — nothing leaves your device until you
            start the upload.
          </p>
        </motion.div>
        <PrivacyStatus mode={privacyMode} />
      </div>

      {/* Pending recovery banner */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-card border border-amber-200/40 bg-amber-400/5">
          <span className="text-body-sm text-amber-200">
            {pendingCount} session{pendingCount > 1 ? 's' : ''} didn't finish uploading.
          </span>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-label text-amber-200 hover:text-amber-100 transition-colors shrink-0"
          >
            View in dashboard →
          </button>
        </div>
      )}

      {/* Drop zones */}
      {phase === 'idle' && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col gap-4">
          <DropZone
            onFileSelect={handleFileSelect}
            selectedFiles={selectedFiles}
            disabled={busy}
          />

          {/* URL input — audio only */}
          <div className="flex flex-col gap-1.5">
            <span className="text-label text-text-secondary">Or fetch audio from a public URL</span>
            <UrlInput onFetched={handleUrlFetched} disabled={busy} />
          </div>

          {/* Adaptive unlock hint */}
          {hasFiles && (
            <div className="flex flex-col gap-2 px-4 py-3 rounded-card border border-amber-200/30 bg-amber-400/5">
              <span className="text-body-sm text-amber-200">
                {!selectedFiles.pdf && !selectedFiles.audio
                  ? 'Add slides or a recording to unlock transcript sync and Red Zone scoring.'
                  : !selectedFiles.pdf
                  ? 'Add slides to unlock PDF sync, heatmap, and slide-level emphasis detection.'
                  : !selectedFiles.audio
                  ? 'Add a recording to unlock transcript, Whisper transcription, and emphasis detection.'
                  : !selectedFiles.guide
                  ? 'Add a Study Guide to upgrade Likely Zone → Red Zone scoring.'
                  : null}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleStartIngestion}
            disabled={!hasFiles}
            className={[
              'h-9 px-4 rounded-btn text-body font-medium transition-colors self-start',
              hasFiles
                ? 'bg-indigo-500 text-text-inverse hover:bg-indigo-600'
                : 'bg-indigo-500 text-text-inverse opacity-30 cursor-not-allowed',
            ].join(' ')}
          >
            Start ingestion
          </button>
        </motion.div>
      )}

      {/* Progress stack */}
      {(phase === 'processing' || phase === 'done' || phase === 'error') && (
        <ProgressStack progress={progress} />
      )}

      {error && (
        <p className="text-label text-rose-300" role="alert">
          {error}
        </p>
      )}

      {phase === 'done' && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="h-9 px-4 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
          >
            Go to dashboard →
          </button>
        </motion.div>
      )}
    </div>
  )
}
