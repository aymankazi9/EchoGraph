'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMasterKey } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'
import type { SyncSegment } from '@/lib/sync/playhead-tracker'

export interface ContinueSessionData {
  id: string
  title_encrypted: string | null
  course_tag: string | null
  last_opened_at: string | null
  last_position_ms: number | null
  slide_count: number   // fallback denominator when no sync_map loaded yet
  red_zone_count: number
}

interface Props {
  session: ContinueSessionData
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

export function ContinueCard({ session }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState<string | null>(null)
  const [syncSegments, setSyncSegments] = useState<SyncSegment[] | null>(null)

  useEffect(() => {
    const mk = getMasterKey()
    if (!mk) return

    // Decrypt session title
    if (session.title_encrypted) {
      decryptText(mk, session.title_encrypted)
        .then(setTitle)
        .catch(() => setTitle(null))
    }

    // Fetch + decrypt sync_map for slide progress
    const sb = createClient()
    sb.from('sync_map')
      .select('map_encrypted')
      .eq('session_id', session.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data?.map_encrypted) return
        decryptText(mk, data.map_encrypted as string)
          .then((json) => setSyncSegments(JSON.parse(json) as SyncSegment[]))
          .catch(() => {})
      })
  }, [session.id, session.title_encrypted])

  const lastPositionMs = session.last_position_ms ?? 0
  const hasPlayback = session.last_position_ms !== null

  // Count segments fully played (endMs ≤ position)
  const reviewedSlides = syncSegments
    ? syncSegments.filter((s) => s.endMs <= lastPositionMs).length
    : 0
  const totalSlides = syncSegments ? syncSegments.length : session.slide_count
  const pct = totalSlides > 0 && hasPlayback
    ? Math.min(Math.round((reviewedSlides / totalSlides) * 100), 100)
    : 0

  const showProgress = hasPlayback && totalSlides > 0

  return (
    <div
      style={{
        padding: '18px 20px',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(99,102,241,0.22)',
        background: 'linear-gradient(110deg, rgba(99,102,241,0.07) 0%, rgba(13,13,20,0.15) 60%)',
        display: 'flex',
        gap: 20,
        alignItems: 'center',
      }}
    >
      {/* Left: metadata + progress */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Label row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', color: '#818CF8', textTransform: 'uppercase' }}>
            Continue Studying
          </span>
          {session.last_opened_at && (
            <>
              <span style={{ fontSize: 10.5, color: '#3F485C' }}>·</span>
              <span style={{ fontSize: 10.5, color: '#5B6478' }}>
                last opened {timeAgo(session.last_opened_at)}
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <p style={{
          fontSize: 20, fontWeight: 600, color: '#E2E8F0', letterSpacing: '-0.02em',
          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title ?? '—'}
        </p>

        {/* Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
          {session.course_tag && (
            <>
              <span style={{ fontSize: 12.5, color: '#64748B' }}>{session.course_tag}</span>
              <span style={{ fontSize: 12.5, color: '#2D3548' }}>·</span>
            </>
          )}
          {session.red_zone_count > 0 && (
            <>
              <span style={{ fontSize: 12.5, color: '#F87171' }}>
                {session.red_zone_count} Red Zone keyword{session.red_zone_count !== 1 ? 's' : ''}
              </span>
              <span style={{ fontSize: 12.5, color: '#2D3548' }}>·</span>
            </>
          )}
          <span style={{ fontSize: 12.5, color: '#64748B' }}>
            {totalSlides} slide{totalSlides !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Progress bar */}
        {showProgress && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#64748B' }}>
                Reviewed {reviewedSlides} of {totalSlides} slides
              </span>
              <span style={{ fontSize: 11.5, color: '#64748B' }}>{pct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 999, background: 'rgba(99,102,241,0.15)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%', borderRadius: 999,
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #6366F1, #818CF8)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Resume button */}
      <button
        type="button"
        onClick={() => router.push(`/session/${session.id}`)}
        style={{
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 44, paddingInline: 20,
          borderRadius: 'var(--radius-card)',
          background: 'rgba(255,255,255,0.93)',
          color: '#0D0D18',
          fontSize: 14, fontWeight: 600,
          border: 'none', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor">
          <path d="M0 0l11 6.5L0 13V0z" />
        </svg>
        Resume
      </button>
    </div>
  )
}
