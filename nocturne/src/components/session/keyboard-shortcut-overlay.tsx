'use client'

import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSessionStore } from '@/store/session-store'

// ─── Shortcut data ─────────────────────────────────────────────────────────────

interface ShortcutRow {
  keys: string[]  // each string is one <kbd> element; adjacent renders side-by-side
  description: string
}

interface ShortcutGroup {
  title: string
  rows: ShortcutRow[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Playback',
    rows: [
      { keys: ['Space'],      description: 'Play / pause' },
      { keys: ['←', '→'],    description: 'Seek 5 seconds' },
      { keys: ['[', ']'],    description: 'Previous / next slide' },
      { keys: ['↑', '↓'],    description: 'Seek 30 seconds' },
    ],
  },
  {
    title: 'Navigation',
    rows: [
      { keys: ['?'],          description: 'Toggle this overlay' },
      { keys: ['Escape'],     description: 'Close panels' },
      { keys: ['T'],          description: 'Focus transcript' },
      { keys: ['P'],          description: 'Focus PDF viewer' },
    ],
  },
  {
    title: 'Session',
    rows: [
      { keys: ['E'],          description: 'Edit session title' },
      { keys: ['F'],          description: 'Toggle flashcard panel' },
      { keys: ['Y'],          description: 'Toggle YouTube panel' },
    ],
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function Kbd({ label }: { label: string }) {
  return (
    <kbd className="bg-bg-subtle border border-border-default rounded px-1.5 py-0.5 font-mono text-caption text-text-secondary">
      {label}
    </kbd>
  )
}

function ShortcutGroupSection({ group }: { group: ShortcutGroup }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-1">
        {group.title}
      </p>
      {group.rows.map((row) => (
        <div key={row.description} className="flex items-center">
          <div className="w-[40%] flex items-center gap-1">
            {row.keys.map((k, i) => (
              <Kbd key={i} label={k} />
            ))}
          </div>
          <span className="w-[60%] text-body-sm text-text-secondary">{row.description}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function KeyboardShortcutOverlay() {
  const isOpen = useSessionStore((s) => s.isShortcutOverlayOpen)
  const toggleShortcutOverlay = useSessionStore((s) => s.toggleShortcutOverlay)

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => { if (!open) toggleShortcutOverlay() }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-[480px] bg-bg-elevated border border-border-default rounded-modal p-6 flex flex-col gap-4"
      >
        <DialogHeader>
          <DialogTitle className="text-subheading font-medium text-text-primary">
            Keyboard shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {GROUPS.map((group, i) => (
            <div key={group.title} className="flex flex-col gap-4">
              <ShortcutGroupSection group={group} />
              {i < GROUPS.length - 1 && <Separator className="bg-border-subtle" />}
            </div>
          ))}
        </div>

        <p className="text-caption text-text-tertiary text-center pt-1">
          Press ? to open this anytime
        </p>
      </DialogContent>
    </Dialog>
  )
}
