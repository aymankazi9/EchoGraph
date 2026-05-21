'use client'

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, Mic, BookOpen } from 'lucide-react'
import { dropAccepted, useMotion } from '@/lib/motion'
import type { FileType } from '@/lib/upload'

interface ZoneConfig {
  type: FileType
  label: string
  icon: React.ReactNode
  accept: string[]
  hint: string
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
]

interface Props {
  onFileSelect: (type: FileType, file: File) => void
  disabled?: boolean
}

interface ZoneProps extends ZoneConfig {
  onFileSelect: Props['onFileSelect']
  disabled: boolean
  droppedFile: File | null
}

function SingleZone({ type, label, icon, accept, hint, onFileSelect, disabled, droppedFile }: ZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [showAccepted, setShowAccepted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { reduced } = useMotion()

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file && accept.some((a) => file.type === a || file.name.endsWith(a.split('/')[1]))) {
      onFileSelect(type, file)
      if (!reduced) {
        setShowAccepted(true)
        setTimeout(() => setShowAccepted(false), 700)
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(type, file)
    e.target.value = ''
  }

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
          : droppedFile
          ? 'border-indigo-500 bg-indigo-500/5'
          : 'border-border-strong hover:border-indigo-500',
      ].join(' ')}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      <span className={droppedFile ? 'text-indigo-400' : 'text-text-secondary'}>{icon}</span>

      <div className="flex flex-col items-center gap-1">
        <span className="text-body font-medium text-text-primary">{label}</span>
        {droppedFile ? (
          <span className="text-label text-indigo-400 max-w-[140px] truncate text-center">
            {droppedFile.name}
          </span>
        ) : (
          <span className="text-caption uppercase tracking-[0.07em] text-text-tertiary">
            {hint}
          </span>
        )}
      </div>

      {!droppedFile && (
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
  disabled?: boolean
}

export function DropZone({ onFileSelect, selectedFiles, disabled = false }: DropZoneProps) {
  return (
    <div className="flex gap-4">
      {ZONES.map((zone) => (
        <SingleZone
          key={zone.type}
          {...zone}
          onFileSelect={onFileSelect}
          disabled={disabled}
          droppedFile={selectedFiles[zone.type] ?? null}
        />
      ))}
    </div>
  )
}
