'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  BookOpen,
  FileText,
  Library,
  Link as LinkIcon,
  Mic,
  Upload,
  X,
} from 'lucide-react'
import { isVaultUnlocked, getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'
import { ingestFiles, type FileProgress, type FileType, type IngestionFile } from '@/lib/upload'
import { UrlInput } from '@/components/ingestion/url-input'
import { ProgressStack } from '@/components/ingestion/progress-stack'
import { db, type LocalSession } from '@/lib/db/dexie'
import { formatBytes } from '@/lib/format'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab   = 'upload' | 'from-url' | 'library'
type Phase = 'idle' | 'processing' | 'done' | 'error'

interface UploadFile {
  id: string
  file:    File | null       // null for URL-fetched audio
  buffer?: ArrayBuffer       // set when file is null
  name:    string
  mimeType: string
  type:    FileType
  sizeBytes: number
}

interface LibraryFileRow {
  id:        string
  fileType:  FileType
  name:      string          // decrypted
  sizeBytes: number
  uploadedAt: string
}

interface Props {
  userId:          string
  storageBytesUsed: number
  storageCapBytes:  number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectFileType(file: File): FileType | null {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('audio/'))                            return 'audio'
  if (file.type === 'text/plain' || name.endsWith('.txt'))      return 'guide'
  return null
}

function fileTypeIcon(type: FileType) {
  if (type === 'pdf')   return <FileText  size={14} strokeWidth={1.5} />
  if (type === 'audio') return <Mic       size={14} strokeWidth={1.5} />
  return                       <BookOpen  size={14} strokeWidth={1.5} />
}

function fileTypeLabel(type: FileType): string {
  if (type === 'pdf')   return 'Slides'
  if (type === 'audio') return 'Recording'
  return 'Guide'
}

async function getAudioDuration(source: File | { buffer: ArrayBuffer; mimeType: string }): Promise<number> {
  return new Promise((resolve) => {
    const blob = source instanceof File
      ? source
      : new Blob([source.buffer], { type: source.mimeType })
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    const cleanup = () => URL.revokeObjectURL(url)
    audio.onloadedmetadata = () => {
      cleanup()
      resolve(isFinite(audio.duration) ? audio.duration : 0)
    }
    audio.onerror = () => { cleanup(); resolve(0) }
    audio.src = url
  })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function estimateTime(audioDurationSec: number, pdfCount: number, guideCount: number): string {
  const total = (audioDurationSec / 60) * 1.5 + pdfCount * 0.3 + guideCount * 0.1 + 0.5
  if (total < 1) return '< 1 min'
  return `~${Math.ceil(total)} min`
}

// ─── Framer Motion variant (from DESIGN_SYSTEM.md §7) ─────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] } },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NewSessionClient({ userId, storageBytesUsed, storageCapBytes }: Props) {
  const router = useRouter()

  // ── Core state ─────────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>('idle')
  const [activeTab,    setActiveTab]    = useState<Tab>('upload')
  const [sessionName,  setSessionName]  = useState('')
  const [uploadFiles,  setUploadFiles]  = useState<UploadFile[]>([])
  const [audioError,   setAudioError]   = useState<string | null>(null)
  const [isDragOver,   setIsDragOver]   = useState(false)
  const [progress,     setProgress]     = useState<FileProgress[]>([])
  const [error,        setError]        = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [audioDuration, setAudioDuration] = useState<number | null>(null)

  // ── Library state ──────────────────────────────────────────────────────────
  const [libraryFiles,    setLibraryFiles]    = useState<LibraryFileRow[]>([])
  const [libraryLoaded,   setLibraryLoaded]   = useState(false)
  const [libraryLoading,  setLibraryLoading]  = useState(false)
  const [librarySelected, setLibrarySelected] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Vault guard + pending sessions count ──────────────────────────────────
  useEffect(() => {
    if (!isVaultUnlocked()) { router.replace('/unlock'); return }
    db.localSessions
      .where('userId').equals(userId)
      .and((s: LocalSession) => s.status === 'ingesting')
      .count()
      .then(setPendingCount)
  }, [router, userId])

  // ── Track audio duration when an audio file is selected ───────────────────
  useEffect(() => {
    const audioFile = uploadFiles.find((f) => f.type === 'audio')
    if (!audioFile) { setAudioDuration(null); return }

    let cancelled = false
    const source = audioFile.file ?? { buffer: audioFile.buffer!, mimeType: audioFile.mimeType }
    getAudioDuration(source).then((d) => { if (!cancelled) setAudioDuration(d) })
    return () => { cancelled = true }
  }, [uploadFiles])

  // ── Load library files when tab first activated ───────────────────────────
  useEffect(() => {
    if (activeTab !== 'library' || libraryLoaded || libraryLoading) return

    async function load() {
      setLibraryLoading(true)
      const supabase = createClient()
      const { data: rows } = await supabase
        .from('files')
        .select('id, file_type, filename_encrypted, size_bytes, uploaded_at')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })

      const mk = getMasterKey()
      const files: LibraryFileRow[] = await Promise.all(
        (rows ?? []).map(async (r) => ({
          id:        r.id as string,
          fileType:  r.file_type as FileType,
          name: mk && r.filename_encrypted
            ? await decryptText(mk, r.filename_encrypted as string).catch(() => r.id as string)
            : r.id as string,
          sizeBytes:  (r.size_bytes  as number) ?? 0,
          uploadedAt:  r.uploaded_at as string,
        })),
      )

      setLibraryFiles(files)
      setLibraryLoaded(true)
      setLibraryLoading(false)
    }

    load()
  }, [activeTab, libraryLoaded, libraryLoading, userId])

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalSources   = uploadFiles.length + librarySelected.size
  const hasAnySources  = totalSources > 0

  const allPdfCount = useMemo(() => {
    const fromUpload  = uploadFiles.filter((f) => f.type === 'pdf').length
    const fromLibrary = [...librarySelected].filter(
      (id) => libraryFiles.find((f) => f.id === id)?.fileType === 'pdf',
    ).length
    return fromUpload + fromLibrary
  }, [uploadFiles, librarySelected, libraryFiles])

  const allGuideCount = useMemo(() => {
    const fromUpload  = uploadFiles.filter((f) => f.type === 'guide').length
    const fromLibrary = [...librarySelected].filter(
      (id) => libraryFiles.find((f) => f.id === id)?.fileType === 'guide',
    ).length
    return fromUpload + fromLibrary
  }, [uploadFiles, librarySelected, libraryFiles])

  const estTime         = estimateTime(audioDuration ?? 0, allPdfCount, allGuideCount)
  const storageUsedPct  = Math.min(100, (storageBytesUsed / storageCapBytes) * 100)

  const libraryByType = useMemo<Record<FileType, LibraryFileRow[]>>(() => {
    const grouped: Record<FileType, LibraryFileRow[]> = { pdf: [], audio: [], guide: [] }
    for (const f of libraryFiles) grouped[f.fileType].push(f)
    return grouped
  }, [libraryFiles])

  // ── File addition helpers ─────────────────────────────────────────────────
  function addFiles(files: File[]) {
    const toAdd: UploadFile[] = []
    let duplicateAudio = false

    for (const file of files) {
      const type = detectFileType(file)
      if (!type) continue

      if (type === 'audio') {
        const alreadyHas = uploadFiles.some((f) => f.type === 'audio') ||
          toAdd.some((f) => f.type === 'audio')
        if (alreadyHas) { duplicateAudio = true; continue }
      }

      toAdd.push({
        id:       crypto.randomUUID(),
        file,
        name:     file.name,
        mimeType: file.type || 'application/octet-stream',
        type,
        sizeBytes: file.size,
      })
    }

    setAudioError(duplicateAudio
      ? 'Only one recording per session is allowed. The existing recording was kept.'
      : null)

    if (toAdd.length > 0) setUploadFiles((prev) => [...prev, ...toAdd])
  }

  function removeUploadFile(id: string) {
    setUploadFiles((prev) => prev.filter((f) => f.id !== id))
    setAudioError(null)
  }

  function handleUrlFetched(buffer: ArrayBuffer, filename: string, mimeType: string) {
    if (uploadFiles.some((f) => f.type === 'audio')) {
      setAudioError('Only one recording per session is allowed. Remove the existing one first.')
      return
    }
    setAudioError(null)
    setUploadFiles((prev) => [
      ...prev,
      { id: crypto.randomUUID(), file: null, buffer, name: filename, mimeType, type: 'audio', sizeBytes: buffer.byteLength },
    ])
  }

  function toggleLibraryFile(id: string) {
    const file = libraryFiles.find((f) => f.id === id)
    if (!file) return

    setLibrarySelected((prev) => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        setAudioError(null)
        return next
      }

      // Audio constraint check
      if (file.fileType === 'audio') {
        const hasAudio = uploadFiles.some((f) => f.type === 'audio') ||
          [...prev].some((sid) => libraryFiles.find((f) => f.id === sid)?.fileType === 'audio')
        if (hasAudio) {
          setAudioError('Only one recording per session is allowed.')
          return prev
        }
      }

      setAudioError(null)
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }

  // ── Ingestion ──────────────────────────────────────────────────────────────
  async function handleStartIngestion() {
    if (!hasAnySources) return
    const mk = getMasterKey()
    if (!mk) { setError('Vault is locked.'); return }

    setError(null)
    setPhase('processing')

    const supabase    = createClient()
    const sessionId   = crypto.randomUUID()
    const name        = sessionName.trim() || 'Untitled'
    const titleEncrypted = await encryptText(mk, name)

    const libraryFilesList = libraryFiles.filter((f) => librarySelected.has(f.id))

    try {
      if (uploadFiles.length > 0) {
        // Convert browser Files/buffers into IngestionFile objects
        const ingestionFiles: IngestionFile[] = await Promise.all(
          uploadFiles.map(async (sf) => ({
            data:      sf.file ? await sf.file.arrayBuffer() : sf.buffer!,
            name:      sf.name,
            mimeType:  sf.mimeType,
            type:      sf.type,
            sizeBytes: sf.sizeBytes,
          })),
        )

        // ingestFiles creates the session (with a filename-derived title)
        await ingestFiles(supabase, ingestionFiles, userId, sessionId, setProgress)

        // Overwrite with user-entered title
        await supabase.from('sessions')
          .update({ title_encrypted: titleEncrypted })
          .eq('id', sessionId)

        // Link any selected library files to the same session
        if (libraryFilesList.length > 0) {
          // Continue from where upload role counters left off
          const roleCounters: Record<string, number> = {}
          for (const uf of uploadFiles) {
            const role = uf.type === 'pdf' ? 'slide' : uf.type
            roleCounters[role] = (roleCounters[role] ?? 0) + 1
          }
          for (const lf of libraryFilesList) {
            const role       = lf.fileType === 'pdf' ? 'slide' : lf.fileType
            const orderIndex = roleCounters[role] ?? 0
            roleCounters[role] = orderIndex + 1
            await supabase.from('session_files').insert({
              session_id: sessionId, file_id: lf.id, role, order_index: orderIndex,
            })
          }
          // Set any flags not already set by ingestFiles
          const flagUpdate: Record<string, boolean> = {}
          if (libraryFilesList.some((f) => f.fileType === 'pdf'))   flagUpdate.has_slides      = true
          if (libraryFilesList.some((f) => f.fileType === 'audio')) flagUpdate.has_audio       = true
          if (libraryFilesList.some((f) => f.fileType === 'guide')) flagUpdate.has_study_guide = true
          if (Object.keys(flagUpdate).length > 0) {
            await supabase.from('sessions').update(flagUpdate).eq('id', sessionId)
          }
        }
      } else {
        // Library-only: create session + link files without upload pipeline
        const hasSlides = libraryFilesList.some((f) => f.fileType === 'pdf')
        const hasAudio  = libraryFilesList.some((f) => f.fileType === 'audio')
        const hasGuide  = libraryFilesList.some((f) => f.fileType === 'guide')

        await supabase.from('sessions').insert({
          id:              sessionId,
          user_id:         userId,
          title_encrypted: titleEncrypted,
          status:          'ingesting',
          has_slides:      hasSlides,
          has_audio:       hasAudio,
          has_study_guide: hasGuide,
        })

        await db.localSessions.add({
          id:           sessionId,
          userId,
          titleEncrypted,
          status:       'ingesting',
          hasSlides,
          hasAudio,
          hasStudyGuide: hasGuide,
          createdAt:    Date.now(),
        })

        const roleCounters: Record<string, number> = {}
        for (const lf of libraryFilesList) {
          const role       = lf.fileType === 'pdf' ? 'slide' : lf.fileType
          const orderIndex = roleCounters[role] ?? 0
          roleCounters[role] = orderIndex + 1
          await supabase.from('session_files').insert({
            session_id: sessionId, file_id: lf.id, role, order_index: orderIndex,
          })
        }

        await supabase.from('sessions').update({ status: 'ready' }).eq('id', sessionId)
        await db.localSessions.update(sessionId, { status: 'ready' })
      }

      setPhase('done')
      router.push(`/session/${sessionId}`)
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Ingestion failed. Check the steps below.')
    }
  }

  const busy = phase === 'processing'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto p-6 flex flex-col gap-6">

      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col gap-1">
        <h1 className="text-display font-medium text-text-primary">New session</h1>
        <p className="text-body text-text-secondary">
          Add sources below. Files are encrypted client-side before upload — nothing leaves your device in plaintext.
        </p>
      </motion.div>

      {/* Pending recovery banner */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-card border border-amber-200/40 bg-amber-400/5">
          <span className="text-body-sm text-amber-200">
            {pendingCount} session{pendingCount > 1 ? 's' : ''} didn&apos;t finish uploading.
          </span>
          <button
            type="button"
            onClick={() => router.push('/vault')}
            className="text-label text-amber-200 hover:text-amber-100 transition-colors shrink-0"
          >
            View in dashboard →
          </button>
        </div>
      )}

      {/* Processing / error */}
      {(phase === 'processing' || phase === 'error') && (
        <div className="flex flex-col gap-4">
          {progress.length > 0 && <ProgressStack progress={progress} />}
          {phase === 'processing' && progress.length === 0 && (
            <p className="text-body-sm text-text-secondary">Creating session…</p>
          )}
          {error && (
            <p className="text-label text-rose-300" role="alert">{error}</p>
          )}
        </div>
      )}

      {/* Idle — two-column layout */}
      {phase === 'idle' && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex gap-6 items-start">

          {/* ── Left: session name + tabs + content ─────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col gap-5">

            {/* Session name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-caption text-text-secondary uppercase tracking-[0.07em]">
                Session name
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. Cardiovascular Physiology — Week 4"
                className="h-9 px-2.5 rounded-card border border-border-default bg-bg-input text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-indigo-500 focus:shadow-indigo"
              />
            </div>

            {/* Tab selector */}
            <div className="flex gap-1 p-1 rounded-card bg-bg-elevated border border-border-default w-fit">
              {(
                [
                  { id: 'upload',   label: 'Upload',   icon: <Upload   size={13} strokeWidth={1.5} /> },
                  { id: 'from-url', label: 'From URL', icon: <LinkIcon size={13} strokeWidth={1.5} /> },
                  { id: 'library',  label: 'Library',  icon: <Library  size={13} strokeWidth={1.5} /> },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    'flex items-center gap-1.5 h-7 px-3 rounded-btn text-label font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-indigo-500/15 text-indigo-400'
                      : 'text-text-secondary hover:text-text-primary',
                  ].join(' ')}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Audio-constraint error — persists across tabs */}
            {audioError && (
              <p
                className="text-label text-amber-200 bg-amber-400/5 border border-amber-200/30 rounded-card px-3 py-2"
                role="alert"
              >
                {audioError}
              </p>
            )}

            {/* ── Upload tab ─────────────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <div className="flex flex-col gap-3">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,audio/*,text/plain,.pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(Array.from(e.target.files))
                    e.target.value = ''
                  }}
                />

                {/* Unified dropzone */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Drop files here or click to browse"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragOver(false)
                    addFiles(Array.from(e.dataTransfer.files))
                  }}
                  className={[
                    'flex flex-col items-center justify-center gap-3 min-h-[160px] cursor-pointer select-none',
                    'border-2 border-dashed rounded-card transition-colors',
                    isDragOver
                      ? 'border-indigo-500 bg-indigo-500/5'
                      : 'border-border-strong hover:border-indigo-500',
                  ].join(' ')}
                >
                  <Upload size={28} strokeWidth={1.25} className="text-text-tertiary" />
                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="text-body font-medium text-text-primary">Drop files here</span>
                    <span className="text-caption uppercase tracking-[0.07em] text-text-tertiary">
                      PDF slides · Audio recording · Study guide (.txt)
                    </span>
                  </div>
                  <span className="text-caption text-text-tertiary">or click to browse</span>
                </div>

                {/* Selected file list */}
                {uploadFiles.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {uploadFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-2.5 h-9 px-3 rounded-card border border-border-default bg-bg-elevated"
                      >
                        <span className="text-text-secondary shrink-0">{fileTypeIcon(f.type)}</span>
                        <span className="flex-1 text-body-sm text-text-primary truncate">{f.name}</span>
                        <span className="text-label text-text-tertiary shrink-0">{formatBytes(f.sizeBytes)}</span>
                        <span className="text-caption uppercase tracking-[0.07em] text-text-tertiary shrink-0 w-16 text-right">
                          {fileTypeLabel(f.type)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeUploadFile(f.id)}
                          aria-label={`Remove ${f.name}`}
                          className="text-text-tertiary hover:text-text-primary transition-colors shrink-0 ml-1"
                        >
                          <X size={13} strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── From URL tab ───────────────────────────────────────────── */}
            {activeTab === 'from-url' && (
              <div className="flex flex-col gap-3">
                <p className="text-body-sm text-text-secondary">
                  Fetch an audio file from a public URL. Direct links only — streaming platforms are not supported.
                </p>
                <UrlInput onFetched={handleUrlFetched} disabled={busy} />
                {uploadFiles.some((f) => f.type === 'audio') && (
                  <p className="text-label text-text-tertiary">
                    Recording added — see the Upload tab to review all selected files.
                  </p>
                )}
              </div>
            )}

            {/* ── Library tab ────────────────────────────────────────────── */}
            {activeTab === 'library' && (
              <div className="flex flex-col gap-4">
                {libraryLoading && (
                  <p className="text-body-sm text-text-secondary">Loading library…</p>
                )}

                {!libraryLoading && libraryFiles.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 min-h-[120px] text-center">
                    <p className="text-body-sm text-text-secondary">No previously uploaded files.</p>
                    <p className="text-label text-text-tertiary">
                      Files you upload will appear here for reuse in future sessions.
                    </p>
                  </div>
                )}

                {!libraryLoading && libraryFiles.length > 0 && (
                  <>
                    {(
                      [
                        ['pdf',   'Slides'],
                        ['audio', 'Recordings'],
                        ['guide', 'Study Guides'],
                      ] as const
                    ).map(([type, label]) => {
                      const files = libraryByType[type]
                      if (files.length === 0) return null
                      return (
                        <div key={type} className="flex flex-col gap-2">
                          <span className="text-caption text-text-tertiary uppercase tracking-[0.07em]">
                            {label}
                          </span>
                          {files.map((f) => {
                            const isSelected = librarySelected.has(f.id)
                            return (
                              <label
                                key={f.id}
                                className={[
                                  'flex items-center gap-2.5 h-9 px-3 rounded-card border cursor-pointer transition-colors',
                                  isSelected
                                    ? 'border-indigo-500/40 bg-indigo-500/5'
                                    : 'border-border-default bg-bg-elevated hover:border-border-strong',
                                ].join(' ')}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleLibraryFile(f.id)}
                                  className="sr-only"
                                />
                                {/* Custom checkbox */}
                                <span
                                  className={[
                                    'w-4 h-4 rounded-[3px] border flex items-center justify-center shrink-0 transition-colors',
                                    isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-border-strong',
                                  ].join(' ')}
                                >
                                  {isSelected && (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                      <path
                                        d="M1 4L3.5 6.5L9 1"
                                        stroke="white"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </span>
                                <span className="flex-1 text-body-sm text-text-primary truncate">{f.name}</span>
                                <span className="text-label text-text-tertiary shrink-0">
                                  {formatBytes(f.sizeBytes)}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* Start ingestion */}
            <button
              type="button"
              onClick={handleStartIngestion}
              disabled={!hasAnySources || busy}
              className={[
                'h-9 px-5 rounded-btn text-body font-medium transition-colors self-start',
                hasAnySources && !busy
                  ? 'bg-indigo-500 text-text-inverse hover:bg-indigo-600'
                  : 'bg-indigo-500/30 text-text-inverse/50 cursor-not-allowed',
              ].join(' ')}
            >
              Start ingestion
            </button>
          </div>

          {/* ── Right: Before you start ──────────────────────────────────── */}
          <div className="w-64 shrink-0 flex flex-col gap-4 p-4 rounded-card border border-border-default bg-bg-elevated">
            <span className="text-caption text-text-tertiary uppercase tracking-[0.07em]">
              Before you start
            </span>

            <div className="flex flex-col gap-3">
              {/* Source count */}
              <div className="flex items-center justify-between">
                <span className="text-label text-text-secondary">Sources</span>
                <span className="text-label text-text-primary font-medium">
                  {totalSources} {totalSources === 1 ? 'file' : 'files'}
                </span>
              </div>

              {/* Audio length */}
              <div className="flex items-center justify-between">
                <span className="text-label text-text-secondary">Audio</span>
                <span className="text-label text-text-primary">
                  {audioDuration != null ? formatDuration(audioDuration) : '—'}
                </span>
              </div>

              {/* Estimated processing time */}
              <div className="flex items-center justify-between">
                <span className="text-label text-text-secondary">Est. time</span>
                <span className="text-label text-text-primary">
                  {hasAnySources ? estTime : '—'}
                </span>
              </div>
            </div>

            {/* Vault space bar */}
            <div className="border-t border-border-subtle pt-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-caption text-text-tertiary uppercase tracking-[0.07em]">Vault</span>
                <span className="text-label text-text-tertiary">
                  {formatBytes(storageBytesUsed)} / {formatBytes(storageCapBytes)}
                </span>
              </div>
              <div className="h-1 w-full rounded-pill bg-bg-subtle overflow-hidden">
                <div
                  className={[
                    'h-full rounded-pill transition-all duration-300',
                    storageUsedPct > 85 ? 'bg-rose-400' :
                    storageUsedPct > 60 ? 'bg-amber-300' :
                                         'bg-indigo-500',
                  ].join(' ')}
                  style={{ width: `${storageUsedPct}%` }}
                />
              </div>
            </div>
          </div>

        </motion.div>
      )}

    </div>
  )
}
