'use client'

import { useState } from 'react'

interface Props {
  onFetched: (data: ArrayBuffer, filename: string, mimeType: string) => void
  disabled?: boolean
}

export function UrlInput({ onFetched, disabled = false }: Props) {
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function handleFetch() {
    setError(null)
    const trimmed = url.trim()

    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('URL must start with http:// or https://')
      return
    }
    // Block known LMS/YouTube URLs — Fetch API only, no special scrapers
    if (/youtube\.com|youtu\.be|panopto|kaltura|canvas|vimeo/i.test(trimmed)) {
      setError('Streaming platform URLs are not supported. Use a direct audio file URL.')
      return
    }

    setFetching(true)
    setProgress(0)
    try {
      const res = await fetch(trimmed)
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`)

      const contentType = res.headers.get('content-type') ?? 'audio/mpeg'
      if (!contentType.startsWith('audio/') && !contentType.startsWith('video/')) {
        throw new Error(`Expected an audio file, got "${contentType}"`)
      }

      // Stream with progress tracking
      const contentLength = Number(res.headers.get('content-length') ?? 0)
      const reader = res.body!.getReader()
      const chunks: Uint8Array[] = []
      let received = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.byteLength
        if (contentLength > 0) setProgress((received / contentLength) * 100)
      }

      const merged = new Uint8Array(received)
      let offset = 0
      for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength }

      const ext = contentType.split('/')[1]?.split(';')[0] ?? 'mp3'
      const filename = trimmed.split('/').pop()?.split('?')[0] ?? `audio.${ext}`

      onFetched(merged.buffer, filename, contentType)
      setUrl('')
      setProgress(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg.includes('CORS') || msg.includes('Failed to fetch')
        ? 'CORS blocked — the server does not allow cross-origin requests.'
        : msg)
    } finally {
      setFetching(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setError(null) }}
          onKeyDown={(e) => e.key === 'Enter' && !fetching && !disabled && handleFetch()}
          placeholder="https://example.com/lecture.mp3"
          disabled={fetching || disabled}
          className={[
            'flex-1 h-9 rounded-input border bg-bg-input text-body text-text-primary px-2.5',
            'placeholder:text-text-tertiary focus:outline-none focus:border-teal-300 focus:shadow-teal',
            error ? 'border-red-200 shadow-red' : 'border-border-default',
            fetching || disabled ? 'opacity-60 cursor-not-allowed' : '',
          ].join(' ')}
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={fetching || disabled || !url.trim()}
          className={[
            'h-9 px-4 rounded-btn text-body font-medium transition-colors shrink-0',
            'border border-border-default text-text-primary',
            fetching || disabled || !url.trim()
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-bg-subtle',
          ].join(' ')}
        >
          {fetching ? 'Fetching…' : 'Fetch →'}
        </button>
      </div>

      {/* Fetch progress bar */}
      {fetching && progress > 0 && (
        <div className="h-1 w-full rounded-pill bg-bg-subtle overflow-hidden">
          <div
            className="h-full rounded-pill bg-teal-300 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {error && (
        <p className="text-label text-red-200" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
