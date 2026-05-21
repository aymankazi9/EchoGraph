'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase'

interface Props {
  userId: string
  initialField: string | null
  initialDismissed: boolean
}

export function DomainPrompt({ userId, initialField, initialDismissed }: Props) {
  const [visible, setVisible] = useState(!initialDismissed && !initialField)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  if (!visible) return null

  function handleDismiss() {
    setVisible(false)
    supabase.from('users').update({ domain_prompt_dismissed: true }).eq('id', userId)
  }

  async function handleSave() {
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    await supabase.from('users').update({ field: trimmed }).eq('id', userId)
    setSaving(false)
    setVisible(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') handleDismiss()
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default bg-bg-elevated">
      <span className="text-label text-text-secondary shrink-0">What are you studying?</span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. Medicine, Law, Computer Science"
        className={[
          'flex-1 h-7 px-2.5 bg-bg-input border border-border-default rounded-input',
          'text-body text-text-primary placeholder:text-text-tertiary',
          'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40',
          'transition-colors',
        ].join(' ')}
        autoFocus
        disabled={saving}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!value.trim() || saving}
        className="h-7 px-3 rounded-btn text-label font-medium bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
      >
        Save
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-text-tertiary hover:text-text-secondary transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} strokeWidth={1.5} />
      </button>
    </div>
  )
}
