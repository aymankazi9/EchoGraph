'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface RawSession {
  status: string
  has_study_guide: boolean
}

interface Props {
  userId: string
  sessions: RawSession[]
  redZoneCounts: Record<string, number>
  initialChecklistDismissed: boolean
  initialChecklistCompleted: boolean
  initialChecklistExported: boolean
}

const ITEMS = [
  'Upload your first lecture',
  'Transcribe a lecture',
  'Export flashcards to Anki',
  'Review Red Zone keywords',
  'Add a study guide',
]

export function GettingStarted({
  userId,
  sessions,
  redZoneCounts,
  initialChecklistDismissed,
  initialChecklistCompleted,
  initialChecklistExported,
}: Props) {
  const [dismissed, setDismissed] = useState(initialChecklistDismissed)
  const didPatchCompleted = useRef(false)
  const supabase = createClient()

  const done = [
    sessions.length > 0,
    sessions.some((s) => ['transcribed', 'syncing', 'synced'].includes(s.status)),
    initialChecklistExported,
    Object.values(redZoneCounts).some((c) => c > 0),
    sessions.some((s) => s.has_study_guide),
  ]

  const completedCount = done.filter(Boolean).length
  const allDone = completedCount === ITEMS.length

  useEffect(() => {
    if (allDone && !initialChecklistCompleted && !dismissed && !didPatchCompleted.current) {
      didPatchCompleted.current = true
      supabase.from('users').update({ checklist_completed: true }).eq('id', userId)
    }
  }, [allDone]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    setDismissed(true)
    supabase.from('users').update({ checklist_dismissed: true }).eq('id', userId)
  }

  if (dismissed || initialChecklistCompleted) return null

  return (
    <div className="mb-6 rounded-card border border-border-default bg-bg-elevated p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-body font-medium text-text-primary">Getting started</span>
          <span className="text-label text-text-tertiary">
            {completedCount} of {ITEMS.length} complete
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-text-tertiary hover:text-text-secondary transition-colors p-0.5"
          aria-label="Dismiss"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-bg-subtle rounded-pill overflow-hidden mb-4">
        <div
          className="h-full bg-indigo-500 rounded-pill transition-all duration-500"
          style={{ width: `${(completedCount / ITEMS.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        {ITEMS.map((label, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div
              className={[
                'w-4 h-4 rounded-full shrink-0 flex items-center justify-center',
                done[i] ? 'bg-indigo-500' : 'border border-border-strong',
              ].join(' ')}
            >
              {done[i] && <Check size={10} strokeWidth={2.5} className="text-white" />}
            </div>
            <span
              className={[
                'text-body-sm',
                done[i] ? 'text-text-tertiary line-through' : 'text-text-secondary',
              ].join(' ')}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
