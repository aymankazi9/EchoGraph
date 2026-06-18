'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, Mic, BookOpen, Layers, MoreHorizontal } from 'lucide-react'
import { cardLift } from '@/lib/motion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onRename: (id: string, newTitle: string) => Promise<void>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ingesting:    { label: 'Ingesting',    className: 'bg-amber-400/20 text-amber-300' },
    processing:   { label: 'Processing',   className: 'bg-amber-400/20 text-amber-300' },
    ready:        { label: 'Ready',        className: 'bg-indigo-500/20 text-indigo-300' },
    synced:       { label: 'Ready',        className: 'bg-indigo-500/20 text-indigo-300' },
    transcribing: { label: 'Transcribing', className: 'bg-violet-500/20 text-violet-300' },
    syncing:      { label: 'Analyzing',    className: 'bg-violet-500/20 text-violet-300' },
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
      <mark className="bg-indigo-900/25 text-inherit">{title.slice(idx, idx + query.length)}</mark>
      {title.slice(idx + query.length)}
    </>
  )
}

export function SessionCard({
  id, title, status, hasSlides, hasAudio, hasStudyGuide, guideType,
  createdAt, redZoneCount, slideCount, sizeMB, onDelete, onRename, highlightQuery = '',
}: Props) {
  const router = useRouter()
  const renameInputRef = useRef<HTMLInputElement>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)

  const isProcessing = ['ingesting', 'processing', 'transcribing', 'syncing'].includes(status)
  const hasKeywords = redZoneCount > 0

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)

    try {
      const supabase = createClient()

      const { data: files } = await supabase
        .from('files')
        .select('storage_path')
        .eq('session_id', id)

      // MANUAL ACTION REQUIRED: Rename bucket "echograph-files" to "nocturne-files" in the Supabase dashboard before deploying.
      if (files && files.length > 0) {
        await supabase.storage
          .from('nocturne-files')
          .remove(files.map((f) => f.storage_path))
      }

      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error

      onDelete(id)
    } catch {
      setDeleting(false)
      setDeleteError('Delete failed. Please try again.')
    }
  }

  function startRename() {
    setRenameValue(title ?? '')
    setRenameError(null)
    setRenaming(true)
    // Focus is handled by autoFocus on the input
  }

  async function commitRename() {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === (title ?? '')) {
      setRenaming(false)
      return
    }
    setRenameSaving(true)
    setRenameError(null)
    try {
      await onRename(id, trimmed)
      setRenaming(false)
    } catch {
      setRenameError('Rename failed. Try again.')
    } finally {
      setRenameSaving(false)
    }
  }

  function navigateToSession() {
    if (renaming) return
    router.push(`/session/${id}`)
  }

  return (
    <motion.div
      variants={cardLift}
      initial="rest"
      whileHover="hover"
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
      className="group relative flex flex-col gap-3 p-4 rounded-card border border-border-default bg-bg-elevated cursor-pointer hover:border-border-strong transition-colors duration-75"
      onClick={navigateToSession}
    >
      {/* Row 1 — status + date */}
      <div className="flex items-center justify-between">
        <StatusBadge status={status} />
        <span className="text-caption text-text-tertiary">{formatDate(createdAt)}</span>
      </div>

      {/* Row 2 — title or inline rename input */}
      {renaming ? (
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-1">
          <input
            ref={renameInputRef}
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { setRenaming(false) }
            }}
            onBlur={commitRename}
            disabled={renameSaving}
            placeholder="Session name"
            className="text-body font-medium text-text-primary bg-bg-subtle border border-border-strong rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          />
          {renameError && (
            <p className="text-caption text-rose-300">{renameError}</p>
          )}
        </div>
      ) : (
        <p className={[
          'text-body font-medium truncate',
          title ? 'text-text-primary' : 'text-text-tertiary italic',
        ].join(' ')}>
          {title
            ? <HighlightedTitle title={title} query={highlightQuery} />
            : 'Untitled session'}
        </p>
      )}

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-violet-500/20 text-violet-300">
            <Layers size={11} strokeWidth={1.5} />
            Auto guide
          </span>
        )}
        {hasStudyGuide && guideType === 'real_guide' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-indigo-500/20 text-indigo-300">
            <BookOpen size={11} strokeWidth={1.5} />
            Study guide
          </span>
        )}
        {hasStudyGuide && guideType === 'anki_import' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-indigo-500/20 text-indigo-300">
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
          <span className="text-rose-300 font-medium">{redZoneCount} Red Zone</span>
          {slideCount > 0 && <> · {slideCount} slides</>}
          {sizeMB > 0 && <> · {sizeMB.toFixed(1)} MB</>}
        </p>
      )}

      {/* Row 5 — action row (hover only) */}
      <div
        className="flex items-center justify-between mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-75"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-caption text-indigo-400">Open session</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More actions"
              className="w-8 h-8 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors"
            >
              <MoreHorizontal size={14} strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={startRename}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-300 focus:text-rose-200 focus:bg-rose-900/30"
              onSelect={() => setDeleteDialogOpen(true)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Controlled delete dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
            <p className="text-body-sm text-rose-300">{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle bg-transparent">
              Keep session
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              disabled={deleting}
              className="h-9 px-4 rounded-btn text-body font-medium bg-transparent border border-rose-900 text-red-300 hover:bg-rose-900/60 transition-colors"
            >
              {deleting ? 'Deleting…' : 'Delete session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
