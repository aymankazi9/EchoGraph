'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { addFilesToExistingSession, type IngestionFile, type FileProgress } from '@/lib/upload'
import { useSessionStore } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'
import { DropZone } from './drop-zone'
import { ProgressStack } from './progress-stack'
import type { FileType } from '@/lib/upload'

interface Props {
  sessionId: string
  userId: string
}

export function UploadPanel({ sessionId, userId }: Props) {
  const closeUploadPanel = useSessionStore((s) => s.closeUploadPanel)
  const setHasSlides = useSessionStore((s) => s.setHasSlides)
  const setHasAudio = useSessionStore((s) => s.setHasAudio)
  const setHasStudyGuide = useSessionStore((s) => s.setHasStudyGuide)

  const [selectedFiles, setSelectedFiles] = useState<Partial<Record<FileType, File>>>({})
  const [progress, setProgress] = useState<FileProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const handleFileSelect = useCallback((type: FileType, file: File) => {
    setSelectedFiles((prev) => ({ ...prev, [type]: file }))
  }, [])

  async function handleUpload() {
    const entries = Object.entries(selectedFiles) as [FileType, File][]
    if (entries.length === 0) return

    setIsUploading(true)
    setError(null)

    try {
      const ingestionFiles: IngestionFile[] = await Promise.all(
        entries.map(async ([type, file]) => ({
          data: await file.arrayBuffer(),
          name: file.name,
          mimeType: file.type,
          type,
          sizeBytes: file.size,
        })),
      )

      await addFilesToExistingSession(supabase, ingestionFiles, userId, sessionId, setProgress)

      // Update store so the guided empty state hides
      if (selectedFiles.pdf) setHasSlides(true)
      if (selectedFiles.audio) setHasAudio(true)
      if (selectedFiles.guide) setHasStudyGuide(true)

      useNotificationStore.getState().notify({
        type: 'success',
        message: 'Files uploaded — processing will begin shortly',
        duration: 4000,
      })

      closeUploadPanel()
    } catch (err) {
      setError('Upload failed. Please try again.')
      console.error('[UploadPanel] upload error:', err)
    } finally {
      setIsUploading(false)
    }
  }

  const hasFiles = Object.keys(selectedFiles).length > 0

  return (
    <motion.div
      key="upload-panel"
      initial={{ x: 420 }}
      animate={{ x: 0 }}
      exit={{ x: 420 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute inset-y-0 right-0 z-20 flex flex-col bg-bg-overlay border-l border-border-default shadow-xl"
      style={{ width: 420 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border-default shrink-0">
        <h2 className="text-subheading font-medium text-text-primary">Add files</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={closeUploadPanel}
          disabled={isUploading}
          className="w-8 h-8 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors disabled:opacity-40"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">
        {progress.length === 0 ? (
          <DropZone
            onFileSelect={handleFileSelect}
            selectedFiles={selectedFiles}
            disabled={isUploading}
          />
        ) : (
          <ProgressStack progress={progress} />
        )}

        {error && (
          <p className="text-body-sm text-rose-300">{error}</p>
        )}
      </div>

      {/* Footer */}
      {progress.length === 0 && (
        <div className="px-5 py-4 border-t border-border-default shrink-0">
          <button
            type="button"
            onClick={handleUpload}
            disabled={!hasFiles || isUploading}
            className="w-full h-9 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Uploading…' : 'Upload files'}
          </button>
        </div>
      )}
    </motion.div>
  )
}
