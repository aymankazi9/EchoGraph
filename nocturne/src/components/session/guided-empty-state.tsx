'use client'

import { Mic, FileText, Layers, ChevronRight, ChevronLeft, Upload } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

interface Props {
  variant: 'audio' | 'transcript' | 'pdf'
}

function Row({
  label,
  description,
  active,
}: {
  label: string
  description: string
  active: boolean
}) {
  return (
    <div
      className={[
        'flex items-start gap-2.5 text-left transition-colors duration-200',
        active ? 'opacity-100' : 'opacity-30',
      ].join(' ')}
    >
      <span
        className={[
          'mt-0.5 w-1.5 h-1.5 rounded-full shrink-0',
          active ? 'bg-indigo-500' : 'bg-text-tertiary',
        ].join(' ')}
      />
      <div className="flex flex-col gap-0.5">
        <span className={['text-body-sm font-medium', active ? 'text-text-primary' : 'text-text-secondary'].join(' ')}>
          {label}
        </span>
        <span className="text-caption text-text-tertiary">{description}</span>
      </div>
    </div>
  )
}

export function GuidedEmptyState({ variant }: Props) {
  const hasSlides = useSessionStore((s) => s.hasSlides)
  const hasAudio = useSessionStore((s) => s.hasAudio)
  const openUploadPanel = useSessionStore((s) => s.openUploadPanel)

  if (variant === 'audio') {
    return (
      <div className="relative flex flex-col items-center justify-center h-full gap-4 px-5 text-center select-none">
        <div className="flex flex-col items-center gap-3">
          <Mic size={28} strokeWidth={1.25} className="text-text-tertiary" />
          <div className="flex flex-col gap-1">
            <p className="text-body font-medium text-text-secondary">Recording</p>
            <p className="text-caption text-text-tertiary max-w-[140px]">
              Upload lecture audio to enable transcription
            </p>
          </div>
        </div>
        {/* Arrow pointing right toward center pane */}
        <ChevronRight
          size={16}
          strokeWidth={1.5}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary animate-pulse"
        />
      </div>
    )
  }

  if (variant === 'pdf') {
    return (
      <div className="relative flex flex-col items-center justify-center h-full gap-4 px-5 text-center select-none">
        <div className="flex flex-col items-center gap-3">
          <FileText size={28} strokeWidth={1.25} className="text-text-tertiary" />
          <div className="flex flex-col gap-1">
            <p className="text-body font-medium text-text-secondary">Slides</p>
            <p className="text-caption text-text-tertiary max-w-[140px]">
              Upload a PDF to map slides to the transcript
            </p>
          </div>
        </div>
        {/* Arrow pointing left toward center pane */}
        <ChevronLeft
          size={16}
          strokeWidth={1.5}
          className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary animate-pulse"
        />
      </div>
    )
  }

  // transcript — center pane, primary CTA
  return (
    <div className="relative flex flex-col items-center justify-center h-full gap-6 px-8 text-center select-none overflow-hidden">
      {/* Ambient glow behind the content */}
      <div
        className="ambient-glow pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 60%, rgba(45,212,191,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-3">
        <Layers size={32} strokeWidth={1.25} className="text-text-tertiary" />
        <div className="flex flex-col gap-1">
          <p className="text-subheading font-medium text-text-primary">Get started</p>
          <p className="text-body-sm text-text-secondary">
            Upload your lecture files to unlock Nocturne
          </p>
        </div>
      </div>

      {/* Input combination rows */}
      <div className="relative flex flex-col gap-3.5 w-full max-w-[240px]">
        <Row
          label="Slides + Audio"
          description="Sync-mapped transcript & Red Zone keywords"
          active={hasSlides && hasAudio}
        />
        <Row
          label="Slides + Study guide"
          description="Red Zone keyword identification"
          active={hasSlides}
        />
        <Row
          label="Audio only"
          description="Searchable transcript"
          active={hasAudio}
        />
      </div>

      <button
        type="button"
        onClick={openUploadPanel}
        className="relative inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
      >
        <Upload size={14} strokeWidth={1.5} />
        Upload files
      </button>
    </div>
  )
}
