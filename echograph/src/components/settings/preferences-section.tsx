'use client'

import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Slider } from '@/components/ui/slider'
import { createClient } from '@/lib/supabase'

const FIELDS = [
  { value: 'premed', label: 'Pre-med' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'law', label: 'Law' },
  { value: 'other', label: 'Other' },
] as const

interface Props {
  userId: string
  initialField: string | null
  initialSilenceMs: number
  tier: string | null
}

function SavedTag() {
  return (
    <motion.span
      key={Date.now()}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="text-caption text-teal-300"
    >
      Saved
    </motion.span>
  )
}

export function PreferencesSection({ userId, initialField, initialSilenceMs, tier }: Props) {
  const [field, setField] = useState(initialField ?? 'other')
  const [silenceMs, setSilenceMs] = useState(initialSilenceMs)
  const [fieldSaved, setFieldSaved] = useState(false)
  const [silenceSaved, setSilenceSaved] = useState(false)
  const fieldDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPro = tier === 'pro'

  const saveField = useCallback(
    (value: string) => {
      if (fieldDebounceRef.current) clearTimeout(fieldDebounceRef.current)
      fieldDebounceRef.current = setTimeout(async () => {
        const supabase = createClient()
        await supabase.from('users').update({ field: value }).eq('id', userId)
        setFieldSaved(true)
        setTimeout(() => setFieldSaved(false), 1500)
      }, 500)
    },
    [userId],
  )

  async function saveSilenceMs(value: number) {
    const supabase = createClient()
    await supabase.from('users').update({ silence_threshold_ms: value }).eq('id', userId)
    setSilenceSaved(true)
    setTimeout(() => setSilenceSaved(false), 1500)
  }

  function handleFieldChange(value: string) {
    setField(value)
    setFieldSaved(false)
    saveField(value)
  }

  return (
    <div>
      <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
        Study preferences
      </p>

      {/* Field selector */}
      <div className="flex flex-col gap-2 py-3 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body-sm text-text-secondary">Your field</p>
            <p className="text-caption text-text-tertiary mt-0.5">
              Affects keyword scoring and domain corpus weighting for your study guide.
            </p>
          </div>
          <AnimatePresence>{fieldSaved && <SavedTag />}</AnimatePresence>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {FIELDS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => handleFieldChange(f.value)}
              className={[
                'px-3.5 py-1.5 rounded-full text-body-sm border transition-colors',
                field === f.value
                  ? 'bg-teal-500/20 text-teal-200 border-teal-300/50'
                  : 'bg-bg-subtle text-text-secondary border-border-default hover:border-border-strong',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Silence threshold */}
      <div className="flex flex-col gap-2 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-body-sm text-text-secondary">Slide sync sensitivity</p>
            <p className="text-caption text-text-tertiary mt-0.5">
              How long a pause in audio triggers a slide transition. Lower = more sensitive.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AnimatePresence>{silenceSaved && <SavedTag />}</AnimatePresence>
            <span className="text-body-sm text-text-tertiary tabular-nums">{silenceMs}ms</span>
          </div>
        </div>

        <div className={isPro ? '' : 'opacity-40 pointer-events-none'}>
          <Slider
            min={500}
            max={3000}
            step={100}
            value={[silenceMs]}
            onValueChange={([v]) => setSilenceMs(v)}
            onValueCommit={([v]) => saveSilenceMs(v)}
            className="mt-1"
          />
        </div>

        {!isPro && (
          <p className="text-caption text-text-tertiary">
            Available on Pro ·{' '}
            <a href="#pricing" className="text-text-secondary hover:text-text-primary transition-colors">
              Upgrade
            </a>
          </p>
        )}
      </div>
    </div>
  )
}
