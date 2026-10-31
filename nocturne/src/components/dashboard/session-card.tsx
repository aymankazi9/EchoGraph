'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { MoreHorizontal } from 'lucide-react'
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
  /** Course name — rendered as a mono eyebrow (Midnight+). */
  courseName?: string | null
  /** True when the user's tier allows the course eyebrow. */
  showCourseTag?: boolean
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
  if (diffDays > 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ingesting:    'Ingesting',
    processing:   'Processing',
    ready:        'Ready',
    synced:       'Ready',
    transcribing: 'Transcribing',
    syncing:      'Analyzing',
  }
  const label = map[status] ?? map['processing']
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: '#9A9A9F', border: '1px solid rgba(255,255,255,0.14)', padding: '2px 6px',
      }}
    >
      {label}
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
      <mark style={{ background: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', color: 'inherit' }}>{title.slice(idx, idx + query.length)}</mark>
      {title.slice(idx + query.length)}
    </>
  )
}

export function SessionCard({
  id, title, status, hasSlides, hasAudio, hasStudyGuide, guideType,
  createdAt, redZoneCount, slideCount, sizeMB, onDelete, onRename,
  highlightQuery = '', courseName, showCourseTag = false,
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

  const metaParts: string[] = []
  if (hasSlides) metaParts.push('Slides')
  if (hasAudio) metaParts.push('Audio')
  if (hasStudyGuide && guideType === 'synthetic') metaParts.push('Auto guide')
  if (hasStudyGuide && guideType === 'real_guide') metaParts.push('Study guide')
  if (hasStudyGuide && guideType === 'anki_import') metaParts.push('Anki deck')

  return (
    <motion.div
      variants={cardLift}
      initial="rest"
      whileHover="hover"
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
      className="group relative flex flex-col gap-3 p-4 border cursor-pointer transition-colors duration-75"
      style={{ background: '#0C0C0D', borderColor: 'rgba(255,255,255,0.08)' }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
      onClick={navigateToSession}
    >
      {/* Row 0 — course eyebrow */}
      {showCourseTag && courseName && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', textTransform: 'uppercase' }}>
          {courseName}
        </span>
      )}

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
            className="text-body font-medium text-text-primary bg-bg-subtle border border-border-strong px-2 py-0.5 w-full focus:outline-none disabled:opacity-50"
            style={{ fontSize: 17 }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          />
          {renameError && (
            <p className="text-caption" style={{ color: 'var(--color-severity)' }}>{renameError}</p>
          )}
        </div>
      ) : (
        <p className={['font-medium truncate', title ? 'text-text-primary' : 'text-text-tertiary italic'].join(' ')} style={{ fontSize: 17 }}>
          {title
            ? <HighlightedTitle title={title} query={highlightQuery} />
            : 'Untitled session'}
        </p>
      )}

      {/* Row 3 — mono meta row */}
      {metaParts.length > 0 && (
        <p className="text-caption text-text-tertiary" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
          {metaParts.join(' · ')}
        </p>
      )}

      {/* Processing progress bar */}
      {isProcessing && (
        <div className="w-full">
          <div className="h-px w-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full w-full animate-pulse" style={{ background: 'var(--color-accent)' }} />
          </div>
          <p className="text-caption mt-1.5" style={{ color: '#9A9A9F' }}>
            Processing — open session to view progress
          </p>
        </div>
      )}

      {/* Row 4 — stats (post-scoring) */}
      {hasKeywords && (
        <p className="text-caption text-text-tertiary" style={{ fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: 'var(--color-severity)', fontWeight: 500 }}>{redZoneCount} Red Zone</span>
          {slideCount > 0 && <> · {slideCount} slides</>}
          {sizeMB > 0 && <> · {sizeMB.toFixed(1)} MB</>}
        </p>
      )}

      {/* Row 5 — action row (hover only) */}
      <div
        className="flex items-center justify-between mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-75"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-caption" style={{ color: '#9A9A9F' }}>Open session</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More actions"
              className="w-8 h-8 flex items-center justify-center text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors"
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
              style={{ color: 'var(--color-severity)' }}
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
            <p className="text-body-sm" style={{ color: 'var(--color-severity)' }}>{deleteError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-9 px-4 text-body text-text-secondary border border-border-default hover:bg-bg-subtle bg-transparent">
              Keep session
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.stopPropagation(); handleDelete() }}
              disabled={deleting}
              className="h-9 px-4 text-body font-medium bg-transparent transition-colors"
              style={{ border: '1px solid var(--color-severity)', color: 'var(--color-severity)' }}
            >
              {deleting ? 'Deleting…' : 'Delete session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
