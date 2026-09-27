'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Mic, BookOpen, PenLine } from 'lucide-react'
import { dropAccepted, useMotion } from '@/lib/motion'
import type { FileType } from '@/lib/upload'

interface ZoneConfig {
  type: FileType
  label: string
  icon: React.ReactNode
  accept: string[]
  hint: string
  multiple?: boolean
}

const ZONES: ZoneConfig[] = [
  {
    type: 'pdf',
    label: 'Slides',
    icon: <FileText size={32} strokeWidth={1.25} />,
    accept: ['application/pdf'],
    hint: '.pdf',
  },
  {
    type: 'audio',
    label: 'Recording',
    icon: <Mic size={32} strokeWidth={1.25} />,
    accept: ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm', 'audio/flac'],
    hint: '.wav · .mp3 · .m4a · .ogg',
  },
  {
    type: 'guide',
    label: 'Study Guide',
    icon: <BookOpen size={32} strokeWidth={1.25} />,
    accept: ['application/pdf', 'text/plain'],
    hint: '.pdf · .txt',
  },
  {
    type: 'handwritten',
    label: 'Handwritten',
    icon: <PenLine size={32} strokeWidth={1.25} />,
    accept: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    hint: '.jpg · .png · .webp · .pdf',
    multiple: true,
  },
]

interface Props {
  onFileSelect: (type: FileType, file: File) => void
  disabled?: boolean
}

interface ZoneProps extends ZoneConfig {
  onFileSelect: Props['onFileSelect']
  disabled: boolean
  droppedFile: File | null
  droppedCount?: number
}

function SingleZone({ type, label, icon, accept, hint, multiple, onFileSelect, disabled, droppedFile, droppedCount }: ZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [showAccepted, setShowAccepted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { reduced } = useMotion()

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (f) => accept.some((a) => f.type === a || f.name.endsWith(a.split('/')[1]))
    )
    if (droppedFiles.length > 0) {
      droppedFiles.forEach((f) => onFileSelect(type, f))
      if (!reduced) {
        setShowAccepted(true)
        setTimeout(() => setShowAccepted(false), 700)
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach((f) => onFileSelect(type, f))
    }
    e.target.value = ''
  }

  const hasContent = droppedFile != null || (droppedCount !== undefined && droppedCount > 0)

  return (
    <motion.div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Drop ${label} file`}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragOver(true) }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      animate={showAccepted ? dropAccepted.animate : {}}
      className={[
        'flex-1 min-h-[200px] flex flex-col items-center justify-center gap-3',
        'border-2 border-dashed rounded-card transition-colors select-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        isDragOver
          ? 'border-indigo-500 bg-indigo-500/5'
          : hasContent
          ? 'border-indigo-500 bg-indigo-500/5'
          : 'border-border-strong hover:border-indigo-500',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <span className={hasContent ? 'text-indigo-400' : 'text-text-secondary'}>{icon}</span>

      <div className="flex flex-col items-center gap-1">
        <span className="text-body font-medium text-text-primary">{label}</span>
        {hasContent ? (
          <span className="text-label text-indigo-400 max-w-[140px] truncate text-center">
            {droppedCount !== undefined && droppedCount > 0
              ? `${droppedCount} file${droppedCount > 1 ? 's' : ''} selected`
              : droppedFile?.name ?? ''}
          </span>
        ) : (
          <span className="text-caption uppercase tracking-[0.07em] text-text-tertiary">
            {hint}
          </span>
        )}
      </div>

      {!hasContent && (
        <span className="text-caption text-text-tertiary">
          Drop or click to browse
        </span>
      )}
    </motion.div>
  )
}

interface DropZoneProps {
  onFileSelect: Props['onFileSelect']
  selectedFiles: Partial<Record<FileType, File>>
  /** Accumulated handwritten image files for the multi-file zone. */
  handwrittenFiles?: File[]
  disabled?: boolean
}

export function DropZone({ onFileSelect, selectedFiles, handwrittenFiles, disabled = false }: DropZoneProps) {
  return (
    <div className="flex gap-4 flex-wrap">
      {ZONES.map((zone) => (
        <SingleZone
          key={zone.type}
          {...zone}
          onFileSelect={onFileSelect}
          disabled={disabled}
          droppedFile={zone.type === 'handwritten' ? null : (selectedFiles[zone.type] ?? null)}
          droppedCount={zone.type === 'handwritten' ? (handwrittenFiles?.length ?? 0) : undefined}
        />
      ))}
    </div>
  )
}
