'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface RibbonData {
  currentStreak: number
  bestStreak: number
  balance: number
  topCourse: { name: string; pct: number } | null
  weekDots: boolean[]
}

function computeStreaks(dates: string[]): { current: number; best: number } {
  if (dates.length === 0) return { current: 0, best: 0 }
  const sorted = [...new Set(dates)].sort()
  let best = 1
  let runLen = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round(
      (new Date(sorted[i]!).getTime() - new Date(sorted[i - 1]!).getTime()) / 86400000,
    )
    if (diff === 1) { runLen++; if (runLen > best) best = runLen }
    else runLen = 1
  }
  const lastDt = new Date(sorted[sorted.length - 1]!)
  lastDt.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (lastDt < yesterday) return { current: 0, best }
  let current = 1
  for (let i = sorted.length - 2; i >= 0; i--) {
    const diff = Math.round(
      (new Date(sorted[i + 1]!).getTime() - new Date(sorted[i]!).getTime()) / 86400000,
    )
    if (diff === 1) current++
    else break
  }
  return { current, best }
}

function buildWeekDots(activitySet: Set<string>): boolean[] {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    if (day > today) return false
    return activitySet.has(day.toISOString().slice(0, 10))
  })
}

export function MomentumRibbon() {
  const [data, setData] = useState<RibbonData | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - 17 * 7)

      const [activityRes, userRes, taggedRes] = await Promise.all([
        supabase
          .from('user_activity')
          .select('date, sessions_played, cards_reviewed')
          .gte('date', since.toISOString().slice(0, 10))
          .order('date'),
        supabase.from('users').select('momentum_points, id').single(),
        supabase.from('sessions').select('id, course_tag').not('course_tag', 'is', null),
      ])

      const activityRows = activityRes.data ?? []
      const activeDates = activityRows
        .filter((r) => (r.sessions_played ?? 0) > 0 || (r.cards_reviewed ?? 0) > 0)
        .map((r) => r.date as string)

      const { current, best } = computeStreaks(activeDates)
      const activitySet = new Set(activeDates)
      const weekDots = buildWeekDots(activitySet)
      const balance = (userRes.data?.momentum_points as number | null) ?? 0

      // Compute top course mastery
      let topCourse: { name: string; pct: number } | null = null
      if (taggedRes.data && taggedRes.data.length > 0 && userRes.data?.id) {
        const userId = userRes.data.id as string
        const tagGroups: Record<string, string[]> = {}
        for (const s of taggedRes.data) {
          const t = s.course_tag as string
          if (!tagGroups[t]) tagGroups[t] = []
          tagGroups[t].push(s.id as string)
        }
        const results: { name: string; pct: number }[] = []
        for (const [tag, sIds] of Object.entries(tagGroups)) {
          const { data: fcs } = await supabase.from('flashcards').select('id').in('session_id', sIds)
          const total = fcs?.length ?? 0
          if (total === 0) continue
          const { data: revs } = await supabase
            .from('flashcard_reviews')
            .select('flashcard_id')
            .in('flashcard_id', (fcs ?? []).map((f) => f.id as string))
            .eq('user_id', userId)
          const reviewed = new Set((revs ?? []).map((r) => r.flashcard_id as string)).size
          results.push({ name: tag, pct: Math.round((reviewed / total) * 100) })
        }
        results.sort((a, b) => b.pct - a.pct)
        if (results.length > 0) topCourse = results[0]!
      }

      setData({ currentStreak: current, bestStreak: best, balance, topCourse, weekDots })
    }

    load().catch(console.error)
  }, [])

  const streak  = data?.currentStreak ?? 0
  const best    = data?.bestStreak ?? 0
  const balance = data?.balance ?? 0
  const dots    = data?.weekDots ?? Array(7).fill(false)
  const course  = data?.topCourse

  return (
    <Link
      href="/momentum"
      data-btn-app
      style={{
        display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' as const,
        marginTop: 20, padding: '13px 18px', borderRadius: 14,
        border: '1px solid rgba(251,191,36,0.22)',
        background: 'linear-gradient(110deg, rgba(251,191,36,0.09) 0%, rgba(244,63,94,0.04) 42%, rgba(13,13,20,0.3) 100%)',
        textDecoration: 'none',
      }}
    >
      {/* Flame chip + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <span style={{
          width: 32, height: 32, flexShrink: 0, borderRadius: 9,
          background: 'radial-gradient(circle at 50% 30%, rgba(251,191,36,0.3), rgba(244,63,94,0.12))',
          border: '1px solid rgba(251,191,36,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBBF24',
        }}>
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 1.5 c2 3 4 4.2 4 7.5 a4 4 0 0 1 -8 0 c0 -1.6 0.8 -2.8 1.6 -3.6 C7 6.5 7.3 7.6 8 8 c0.3 -2 0 -4.5 1 -6.5 Z" />
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: '#E2E8F0' }}>
            <span style={{ fontWeight: 600 }}>
              {streak > 0 ? `${streak}-day study streak` : 'Start your streak today'}
            </span>{' '}
            {best > 0 && <span style={{ color: '#5B6478' }}>· best {best}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 1 }}>
            {course
              ? <>{course.name} is <span style={{ color: '#FCD34D' }}>{course.pct}% exam-ready</span></>
              : <span style={{ color: '#5B6478' }}>Tag sessions with a subject to track mastery</span>
            }
          </div>
        </div>
      </div>

      {/* 7-day dot strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {dots.map((done, i) => (
          <span
            key={i}
            style={{
              width: 13, height: 13, borderRadius: 4,
              background: done ? 'linear-gradient(145deg,#FBBF24,#F59E0B)' : undefined,
              border: done ? undefined : '1px dashed #2D2B45',
            }}
          />
        ))}
      </div>

      {/* Balance + CTA */}
      <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#FCD34D', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 1.5 L4 10 h4 l-1 6.5 L14 7 h-4 Z" />
          </svg>
          {balance.toLocaleString()}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#A5B4FC', fontWeight: 500, whiteSpace: 'nowrap' }}>
          Open Momentum{' '}
          <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9 h9 M9 5 l4 4 l-4 4" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
