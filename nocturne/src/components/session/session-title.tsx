'use client'

import { useEffect, useRef, useState } from 'react'
import { Edit2, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { createClient } from '@/lib/supabase'
import { useSessionStore } from '@/store/session-store'
import { useNotificationStore } from '@/store/notification-store'

interface Props {
  sessionId: string
}

export function SessionTitle({ sessionId }: Props) {
  const sessionTitle = useSessionStore((s) => s.sessionTitle)
  const setSessionTitle = useSessionStore((s) => s.setSessionTitle)
  const isTitleEditing = useSessionStore((s) => s.isTitleEditing)
  const clearTitleEdit = useSessionStore((s) => s.clearTitleEdit)
  const notify = useNotificationStore((s) => s.notify)

  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [emptyError, setEmptyError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const savedTitleRef = useRef(sessionTitle)

  // Keep the ref in sync so cancel() can restore without stale closure.
  useEffect(() => {
    if (!isEditing) savedTitleRef.current = sessionTitle
  }, [sessionTitle, isEditing])

  // E shortcut triggers edit mode via store flag.
  useEffect(() => {
    if (isTitleEditing && !isEditing) {
      enterEdit()
      clearTitleEdit()
    }
  }, [isTitleEditing]) // eslint-disable-line react-hooks/exhaustive-deps

  // Select all content when input mounts.
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.select()
    }
  }, [isEditing])

  function enterEdit() {
    setEditValue(sessionTitle)
    setEmptyError(false)
    setIsEditing(true)
  }

  function cancel() {
    setIsEditing(false)
    setEmptyError(false)
    setEditValue('')
  }

  async function save() {
    const trimmed = editValue.trim()
    if (!trimmed) {
      setEmptyError(true)
      return
    }

    setEmptyError(false)
    setIsEditing(false)

    const mk = getMasterKey()
    if (!mk) return

    const previous = savedTitleRef.current
    setSessionTitle(trimmed)    // optimistic update
    setIsSaving(true)

    try {
      const ciphertext = await encryptText(mk, trimmed)
      const supabase = createClient()
      const { error } = await supabase
        .from('sessions')
        .update({ title_encrypted: ciphertext })
        .eq('id', sessionId)

      if (error) throw error

      notify({ type: 'success', message: 'Session renamed', duration: 2000 })
    } catch {
      setSessionTitle(previous)
      notify({ type: 'error', message: 'Failed to save title', duration: 4000 })
    } finally {
      setIsSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  const layoutId = `session-title-${sessionId}`

  if (isEditing) {
    return (
      <motion.div layout layoutId={layoutId} className="flex flex-col gap-0.5">
        <input
          ref={inputRef}
          autoFocus
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value.slice(0, 80))
            if (emptyError && e.target.value.trim()) setEmptyError(false)
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (editValue.trim()) save(); else cancel() }}
          maxLength={80}
          className={[
            'text-subheading font-medium text-text-primary',
            'bg-transparent border-b outline-none focus:outline-none w-[320px]',
            emptyError ? 'border-rose-400' : 'border-indigo-500',
          ].join(' ')}
        />
        <div className="flex items-center justify-between">
          <AnimatePresence>
            {emptyError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-caption text-rose-300"
              >
                Title cannot be empty
              </motion.p>
            )}
          </AnimatePresence>
          <span className="text-caption text-text-tertiary ml-auto">
            {editValue.length} / 80
          </span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      layout
      layoutId={layoutId}
      className="relative group/stitle flex items-center gap-1.5 cursor-text"
      onClick={enterEdit}
    >
      <span className="text-subheading font-medium text-text-primary max-w-[320px] truncate select-none">
        {sessionTitle || '···'}
      </span>

      {!isSaving && (
        <span className="opacity-0 group-hover/stitle:opacity-100 transition-opacity">
          <Edit2 size={12} strokeWidth={1.5} className="text-text-tertiary" />
        </span>
      )}

      {isSaving && (
        <Loader2 size={12} strokeWidth={1.5} className="text-text-secondary animate-spin shrink-0" />
      )}
    </motion.div>
  )
}
