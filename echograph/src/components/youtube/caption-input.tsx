'use client'

// Mode B: YouTube URL input → caption fetch → flashcard generation.

import { useState, useCallback } from 'react'
import type { Flashcard } from '@/lib/scoring/flashcard-generator'
import type { StoredKeyword } from '@/store/session-store'
import type { CaptionError } from '@/lib/youtube/captions'

interface Props {
  keywords: StoredKeyword[]
  onFlashcards: (cards: Flashcard[]) => void
}

const ERROR_MESSAGES: Record<CaptionError, string> = {
  invalid_url: 'Please enter a valid YouTube URL.',
  no_captions: 'This video has no auto-generated captions.',
  cors_blocked: 'Caption access requires server-side fetch. Available in Scholar tier.',
  no_matches: 'No Red Zone keywords found in this video\'s captions.',
  api_error: 'YouTube API is not configured.',
}

export function CaptionInput({ keywords, onFlashcards }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)

  const handleExtract = useCallback(async () => {
    if (!url.trim() || loading) return
    setError(null)
    setSuccessCount(null)
    setLoading(true)

    try {
      const { fetchCaptionTrack } = await import('@/lib/youtube/captions')
      const { generateFlashcardsFromCaptions } = await import('@/lib/youtube/youtube-flashcards')

      const matches = await fetchCaptionTrack(url.trim(), keywords)
      const cards = generateFlashcardsFromCaptions(matches)
      onFlashcards(cards)
      setSuccessCount(cards.length)
      setUrl('')
    } catch (e) {
      const code = (e as { code?: string }).code as CaptionError | undefined
      setError(code ? (ERROR_MESSAGES[code] ?? 'An unexpected error occurred.') : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }, [url, loading, keywords, onFlashcards])

  return (
    <div className="pt-3 border-t border-border-default">
      <p className="text-label text-text-tertiary mb-1.5">
        Or paste a YouTube URL for flashcards
      </p>
      <div className="flex gap-1.5">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null); setSuccessCount(null) }}
          placeholder="https://youtube.com/watch?v=..."
          className={[
            'flex-1 h-8 px-2 rounded-input border bg-bg-input text-body-sm text-text-primary',
            'placeholder:text-text-tertiary focus:outline-none transition-colors',
            error
              ? 'border-red-200 focus:border-red-200 shadow-red'
              : 'border-border-default focus:border-teal-300 focus:shadow-teal',
          ].join(' ')}
          onKeyDown={(e) => { if (e.key === 'Enter') handleExtract() }}
        />
        <button
          type="button"
          disabled={!url.trim() || loading}
          onClick={handleExtract}
          className={[
            'h-8 px-3 rounded-btn text-label border border-border-default',
            'text-text-secondary hover:bg-bg-subtle transition-colors',
            !url.trim() || loading ? 'opacity-40 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {loading ? '…' : 'Extract'}
        </button>
      </div>

      {error && (
        <p className="text-caption text-red-200 mt-1">{error}</p>
      )}
      {successCount !== null && !error && (
        <p className="text-caption text-teal-300 mt-1">
          {successCount} flashcard{successCount !== 1 ? 's' : ''} added
        </p>
      )}
    </div>
  )
}
