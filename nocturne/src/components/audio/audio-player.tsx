'use client'

// HTML5 audio player in the left 20% pane. Decrypts audio on mount,
// registers the <audio> element with the session store, and wires events.
// DESIGN_SYSTEM.md §6: play/pause = 40×40 indigo-500 circle.

import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'
import { getMasterKey } from '@/lib/crypto/vault'
import { fetchAndDecryptFile } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'
import { useSessionStore } from '@/store/session-store'
import { SeekBar } from './seek-bar'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const
type Speed = (typeof SPEEDS)[number]

interface Props {
  audioStoragePath: string
  headless?: boolean
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function AudioPlayer({ audioStoragePath, headless = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(true)
  const lastUpdateRef = useRef(0)
  const supabase = createClient()

  const registerAudio = useSessionStore((s) => s.registerAudio)
  const unregisterAudio = useSessionStore((s) => s.unregisterAudio)
  const onTimeUpdate = useSessionStore((s) => s.onTimeUpdate)
  const onDurationChange = useSessionStore((s) => s.onDurationChange)
  const onPlayStateChange = useSessionStore((s) => s.onPlayStateChange)
  const isPlaying = useSessionStore((s) => s.isPlaying)
  const playbackSpeed = useSessionStore((s) => s.playbackSpeed)
  const setSpeed = useSessionStore((s) => s.setSpeed)
  const currentTimeMs = useSessionStore((s) => s.currentTimeMs)
  const durationMs = useSessionStore((s) => s.durationMs)

  // ── Decrypt audio on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let url = ''

    async function load() {
      const mk = getMasterKey()
      if (!mk) { setLoadError('Vault locked — please unlock.'); setIsDecrypting(false); return }

      try {
        const buffer = await fetchAndDecryptFile(supabase, audioStoragePath, mk)
        if (cancelled) return
        const blob = new Blob([buffer], { type: 'audio/ogg; codecs=opus' })
        url = URL.createObjectURL(blob)
        setObjectUrl(url)
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Audio load failed')
      } finally {
        if (!cancelled) setIsDecrypting(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [audioStoragePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Register audio element with store once src is ready ─────────────────
  useEffect(() => {
    if (!audioRef.current || !objectUrl) return
    registerAudio(audioRef.current)
    return () => unregisterAudio()
  }, [objectUrl, registerAudio, unregisterAudio])

  // ── Sync playbackRate when speed changes ────────────────────────────────
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackSpeed
  }, [playbackSpeed])

  // ── Audio event handlers ────────────────────────────────────────────────
  const handleTimeUpdate = useCallback(() => {
    const now = performance.now()
    if (now - lastUpdateRef.current < 250) return  // throttle to 250ms
    lastUpdateRef.current = now
    if (audioRef.current) onTimeUpdate(audioRef.current.currentTime * 1000)
  }, [onTimeUpdate])

  const handleDurationChange = useCallback(() => {
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      onDurationChange(audioRef.current.duration * 1000)
    }
  }, [onDurationChange])

  const handlePlay = useCallback(() => onPlayStateChange(true), [onPlayStateChange])
  const handlePause = useCallback(() => onPlayStateChange(false), [onPlayStateChange])
  const handleEnded = useCallback(() => onPlayStateChange(false), [onPlayStateChange])

  // ── Play/pause toggle ───────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    if (!audioRef.current || !objectUrl) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play().catch(() => {})
  }, [isPlaying, objectUrl])

  // ── Speed cycle ─────────────────────────────────────────────────────────
  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(playbackSpeed as Speed)
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length])
  }, [playbackSpeed, setSpeed])

  // ── Render ──────────────────────────────────────────────────────────────

  if (headless) {
    return (
      <audio
        ref={audioRef}
        src={objectUrl ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        preload="metadata"
      />
    )
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-label text-rose-300 text-center">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={objectUrl ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Spacer — push controls to vertical center */}
      <div className="flex-1" />

      {/* Time display */}
      <div className="flex justify-between">
        <span className="text-caption text-text-tertiary font-mono">
          {formatTime(currentTimeMs)}
        </span>
        <span className="text-caption text-text-tertiary font-mono">
          {durationMs > 0 ? formatTime(durationMs) : '--:--'}
        </span>
      </div>

      {/* Seek bar */}
      <SeekBar />

      {/* Controls row */}
      <div className="flex items-center gap-3">
        {/* Play/pause — 40×40 primary teal, DESIGN_SYSTEM.md §6 */}
        <button
          type="button"
          onClick={togglePlay}
          disabled={!objectUrl || isDecrypting}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="w-10 h-10 rounded-full bg-indigo-500 text-text-inverse flex items-center justify-center hover:bg-indigo-600 transition-colors disabled:opacity-40 shrink-0"
        >
          {isDecrypting ? (
            <span className="w-3 h-3 rounded-full border-2 border-text-inverse border-t-transparent animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} strokeWidth={2} />
          ) : (
            <Play size={16} strokeWidth={2} className="translate-x-px" />
          )}
        </button>

        {/* Speed selector — ghost cycling button, DESIGN_SYSTEM.md §6 */}
        <button
          type="button"
          onClick={cycleSpeed}
          disabled={isDecrypting}
          className="text-body-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40 w-10 text-center"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Keyboard shortcut hint — bottom of pane, DESIGN_SYSTEM.md §6 */}
      <p className="text-caption text-text-tertiary text-center select-none">
        Space · ← → · [ ]
      </p>
    </div>
  )
}
