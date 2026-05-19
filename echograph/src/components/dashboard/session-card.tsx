'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Mic, BookOpen, Layers, Trash2, Download, MoreHorizontal } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase'

interface Props {
  id: string
  title: string | null
  status: string
  hasSlides: boolean
  hasAudio: boolean
  hasStudyGuide: boolean
  guideType: string | null
  createdAt: string
  redZoneCount: number
  slideCount: number
  sizeMB: number
  onDelete: (id: string) => void
  /** When non-empty, highlights the matched substring in the title. */
  highlightQuery?: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays > 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatusBadge({ status, hasKeywords }: { status: string; hasKeywords: boolean }) {
  const map: Record<string, { label: string; className: string }> = {
    ingesting:     { label: 'Ingesting',    className: 'bg-amber-400/20 text-amber-200' },
    processing:    { label: 'Processing',   className: 'bg-amber-400/20 text-amber-200' },
    transcribing:  { label: 'Transcribing', className: 'bg-purple-500/20 text-purple-200' },
    syncing:       { label: 'Analyzing',    className: 'bg-purple-500/20 text-purple-200' },
  }

  if (status === 'synced') {
    return hasKeywords ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-teal-500/20 text-teal-200">
        Ready
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-bg-subtle text-text-secondary">
        Synced
      </span>
    )
  }

  const config = map[status] ?? map['processing']
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-caption ${config.className}`}>
      {config.label}
    </span>
  )
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  if (!query) return <>{title}</>
  const idx = title.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <>{title}</>
  return (
    <>
      {title.slice(0, idx)}
      <mark className="bg-teal-500/25 text-inherit">{title.slice(idx, idx + query.length)}</mark>
      {title.slice(idx + query.length)}
    </>
  )
}

export function SessionCard({
  id, title, status, hasSlides, hasAudio, hasStudyGuide, guideType,
  createdAt, redZoneCount, slideCount, sizeMB, onDelete, highlightQuery = '',
}: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const isProcessing = ['ingesting', 'processing', 'transcribing', 'syncing'].includes(status)
  const hasKeywords = redZoneCount > 0

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)

    try {
      const supabase = createClient()

      // Fetch all file paths for this session first
      const { data: files } = await supabase
        .from('files')
        .select('storage_path')
        .eq('session_id', id)

      // Delete from storage FIRST (orphan prevention)
      if (files && files.length > 0) {
        await supabase.storage
          .from('echograph-files')
          .remove(files.map((f) => f.storage_path))
      }

      // Delete session row — CASCADE handles the rest
      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error

      onDelete(id)
    } catch {
      setDeleting(false)
      setDeleteError('Delete failed. Please try again.')
    }
  }

  function navigateToSession() {
    router.push(`/session/${id}`)
  }

  return (
    <div
      className="group relative flex flex-col gap-3 p-4 rounded-card border border-border-default bg-bg-elevated cursor-pointer hover:border-border-strong transition-colors duration-75"
      onClick={navigateToSession}
    >
      {/* Row 1 — status + date */}
      <div className="flex items-center justify-between">
        <StatusBadge status={status} hasKeywords={hasKeywords} />
        <span className="text-caption text-text-tertiary">{formatDate(createdAt)}</span>
      </div>

      {/* Row 2 — title */}
      <p className={[
        'text-body font-medium truncate',
        title ? 'text-text-primary' : 'text-text-tertiary italic',
      ].join(' ')}>
        {title
          ? <HighlightedTitle title={title} query={highlightQuery} />
          : 'Untitled session'}
      </p>

      {/* Row 3 — input badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasSlides && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-bg-subtle text-text-secondary">
            <FileText size={11} strokeWidth={1.5} />
            Slides
          </span>
        )}
        {hasAudio && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-bg-subtle text-text-secondary">
            <Mic size={11} strokeWidth={1.5} />
            Audio
          </span>
        )}
        {hasStudyGuide && guideType === 'synthetic' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-purple-500/20 text-purple-200">
            <Layers size={11} strokeWidth={1.5} />
            Auto guide
          </span>
        )}
        {hasStudyGuide && guideType === 'real_guide' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-teal-500/20 text-teal-200">
            <BookOpen size={11} strokeWidth={1.5} />
            Study guide
          </span>
        )}
        {hasStudyGuide && guideType === 'anki_import' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-teal-500/20 text-teal-200">
            <BookOpen size={11} strokeWidth={1.5} />
            Anki deck
          </span>
        )}
      </div>

      {/* Processing progress bar */}
      {isProcessing && (
        <div className="w-full">
          <div className="h-1 w-full rounded-full bg-bg-subtle overflow-hidden">
            <div className="h-full w-full bg-amber-200/40 animate-pulse rounded-full" />
          </div>
          <p className="text-caption text-amber-200 mt-1.5">
            Processing — open session to view progress
          </p>
        </div>
      )}

      {/* Row 4 — stats (post-scoring) */}
      {hasKeywords && (
        <p className="text-caption text-text-tertiary">
          <span className="text-red-200 font-medium">{redZoneCount} Red Zone</span>
          {slideCount > 0 && <> · {slideCount} slides</>}
          {sizeMB > 0 && <> · {sizeMB.toFixed(1)} MB</>}
        </p>
      )}

      {/* Row 5 — action row (hover only, click stops propagation) */}
      <div
        className="flex items-center justify-between mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-75"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-caption text-teal-300">Open session</span>

        <div className="flex items-center gap-0.5">
          {/* Delete */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                aria-label="Delete session"
                className="w-8 h-8 flex items-center justify-center rounded-btn text-text-tertiary hover:text-red-200 hover:bg-bg-subtle transition-colors"
              >
                <Trash2 size={14} strokeWidth={1.5} />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-bg-overlay border border-border-default max-w-sm">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-subheading font-medium text-text-primary">
                  Delete this session?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-body-sm text-text-secondary">
                  This permanently deletes your encrypted files from the vault. This cannot be
                  undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteError && (
                <p className="text-body-sm text-red-200">{deleteError}</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel className="h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle bg-transparent">
                  Keep session
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-9 px-4 rounded-btn text-body font-medium bg-transparent border border-red-500 text-red-300 hover:bg-red-500/20 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete session'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Export — placeholder */}
          <button
            type="button"
            aria-label="Export notes"
            className="w-8 h-8 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors"
          >
            <Download size={14} strokeWidth={1.5} />
          </button>

          {/* More — placeholder */}
          <button
            type="button"
            aria-label="More actions"
            className="w-8 h-8 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors"
          >
            <MoreHorizontal size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
