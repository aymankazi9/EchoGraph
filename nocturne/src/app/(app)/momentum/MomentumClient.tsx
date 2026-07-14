'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RedeemItem {
  name: string
  sub: string
  cost: number
  iconColor: string // rgb string e.g. "251,191,36"
  icon: React.ReactNode
}

interface MilestoneItem {
  icon: React.ReactNode
  title: string
  sub: string
  earned: boolean
  progress?: string // e.g. "12/14"
  color: string    // rgb e.g. "251,191,36"
}

interface CourseData {
  name: string
  pct: number
  done: number
  total: number
}

// ---------------------------------------------------------------------------
// SVG icon helpers (inline, no deps)
// ---------------------------------------------------------------------------
const BoltIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 1.5 L4 10 h4 l-1 6.5 L14 7 h-4 Z" />
  </svg>
)
const FlameIcon = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 1.5 c2 3 4 4.2 4 7.5 a4 4 0 0 1 -8 0 c0 -1.6 0.8 -2.8 1.6 -3.6 C7 6.5 7.3 7.6 8 8 c0.3 -2 0 -4.5 1 -6.5 Z" />
  </svg>
)
const CheckIcon = ({ size = 11, stroke = '#09090F' }: { size?: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9.5 L7.5 13 L14 5" />
  </svg>
)
const CheckCircleIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7" />
    <path d="M5.5 9 L8 11.5 L12.5 6.5" />
  </svg>
)
const WaveIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9 q2.25 -4 4.5 0 t4.5 0 t4.5 0" />
  </svg>
)
const CrownIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 5 L6 9 L9 3.5 L12 9 L15.5 5 L14 14 H4 Z" />
  </svg>
)
const StackIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2 L16 6 L9 10 L2 6 Z" />
    <path d="M2 11 L9 15 L16 11" />
  </svg>
)
const CardsIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2.5" y="5" width="10" height="9" rx="1.5" />
    <path d="M6 5 V3.6 a1 1 0 0 1 1 -1 h7 a1 1 0 0 1 1 1 v8 a1 1 0 0 1 -1 1 h-1.5" />
  </svg>
)
const TargetIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="9" r="7" />
    <circle cx="9" cy="9" r="3.4" />
    <circle cx="9" cy="9" r="0.4" fill="currentColor" />
  </svg>
)
const TrophyIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2.5 h8 v3 a4 4 0 0 1 -8 0 Z" />
    <path d="M5 3.5 H3 a1.5 1.5 0 0 0 0 3 h0.5 M13 3.5 h2 a1.5 1.5 0 0 1 0 3 h-0.5 M9 9.5 V12 M6.5 15 h5 M7.5 12 h3 v1.5 h-3 Z" />
  </svg>
)
const LockIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="8" width="10" height="7" rx="1.5" />
    <path d="M6 8 V6 a3 3 0 0 1 6 0 v2" />
  </svg>
)
const PeopleIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7" cy="7" r="2.6" />
    <path d="M2.5 16 c0 -2.8 2 -4.6 4.5 -4.6 s4.5 1.8 4.5 4.6" />
    <path d="M13 4.6 a2.5 2.5 0 0 1 0 4.8 M14 11.6 c2.2 0.4 3.5 2 3.5 4.4" />
  </svg>
)
const ArrowRightIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9 h9 M9 5 l4 4 l-4 4" />
  </svg>
)
const DownloadIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3 v8 M5.5 7.5 L9 11 L12.5 7.5 M3 14 H15" />
  </svg>
)

// ---------------------------------------------------------------------------
// Heatmap constants
// ---------------------------------------------------------------------------
const HEATMAP_SCALE = [
  '#13121C',
  'rgba(99,102,241,0.28)',
  'rgba(99,102,241,0.5)',
  'rgba(99,102,241,0.74)',
  '#818CF8',
]
const WEEKS_N = 17
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface HeatCell { lvl: number; title: string }
interface HeatWeek { days: HeatCell[] }
interface HeatData {
  weeks: HeatWeek[]
  activeDays: number
  monthDefs: Array<[string, number]>
}

// ---------------------------------------------------------------------------
// Pure data utilities
// ---------------------------------------------------------------------------

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

function buildWeekDays(activitySet: Set<string>): Array<{ label: string; done: boolean }> {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  return labels.map((label, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    if (day > today) return { label, done: false }
    return { label, done: activitySet.has(day.toISOString().slice(0, 10)) }
  })
}

function buildHeatmapFromActivity(
  rows: { date: string; sessions_played: number; cards_reviewed: number }[],
): HeatData {
  const activityMap = new Map<string, number>()
  for (const r of rows) {
    activityMap.set(r.date as string, (r.sessions_played ?? 0) + Math.floor((r.cards_reviewed ?? 0) / 10))
  }

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7))
  const startDate = new Date(monday)
  startDate.setDate(monday.getDate() - 16 * 7)

  let activeDays = 0
  const weeks: HeatWeek[] = []
  const monthDefs: Array<[string, number]> = []
  let lastMonth = -1

  for (let w = 0; w < WEEKS_N; w++) {
    const weekStart = new Date(startDate)
    weekStart.setDate(startDate.getDate() + w * 7)
    const month = weekStart.getMonth()
    if (month !== lastMonth) {
      monthDefs.push([MONTH_NAMES[month]!, w])
      lastMonth = month
    }
    const days: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(weekStart)
      cellDate.setDate(weekStart.getDate() + d)
      if (cellDate > today) { days.push({ lvl: 0, title: 'No activity' }); continue }
      const dateStr = cellDate.toISOString().slice(0, 10)
      const intensity = activityMap.get(dateStr) ?? 0
      let lvl = 0
      if (intensity >= 10) lvl = 4
      else if (intensity >= 5) lvl = 3
      else if (intensity >= 2) lvl = 2
      else if (intensity >= 1) lvl = 1
      if (lvl > 0) activeDays++
      const label = cellDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      days.push({ lvl, title: intensity > 0 ? `${intensity} sessions · ${label}` : `No activity · ${label}` })
    }
    weeks.push({ days })
  }
  return { weeks, activeDays, monthDefs }
}

function buildMilestoneItems(
  earned: Set<string>,
  streak: number,
  sessionCount: number,
  cardCount: number,
  courses: CourseData[],
): MilestoneItem[] {
  const masteredCount = courses.filter((c) => c.pct >= 80).length
  const firstMastered = courses.find((c) => c.pct >= 80)
  return [
    {
      icon: <FlameIcon size={14} />,
      title: 'Two-week warrior',
      sub: earned.has('streak_14') ? '14 day streak achieved' : `${streak} of 14 day streak`,
      earned: earned.has('streak_14'),
      progress: earned.has('streak_14') ? undefined : `${streak}/14`,
      color: '251,191,36',
    },
    {
      icon: <TargetIcon />,
      title: 'First subject mastered',
      sub: firstMastered ? firstMastered.name : 'Reach 80% on any subject',
      earned: earned.has('subject_mastered'),
      progress: earned.has('subject_mastered') ? undefined : `${masteredCount}/1`,
      color: '45,212,191',
    },
    {
      icon: <StackIcon />,
      title: '25 lectures captured',
      sub: earned.has('sessions_25') ? '25 sessions in your vault' : `${sessionCount} of 25`,
      earned: earned.has('sessions_25'),
      progress: earned.has('sessions_25') ? undefined : `${sessionCount}/25`,
      color: '99,102,241',
    },
    {
      icon: <CardsIcon />,
      title: '500 cards drilled',
      sub: earned.has('cards_500') ? '500 reviews completed' : `${cardCount} of 500 reviewed`,
      earned: earned.has('cards_500'),
      progress: earned.has('cards_500') ? undefined : `${cardCount}/500`,
      color: '139,92,246',
    },
    {
      icon: <TrophyIcon />,
      title: 'Course conqueror',
      sub: earned.has('subjects_3') ? '3 subjects mastered' : `${masteredCount} of 3 subjects`,
      earned: earned.has('subjects_3'),
      progress: earned.has('subjects_3') ? undefined : `${masteredCount}/3`,
      color: '244,63,94',
    },
  ]
}

function masteryTag(pct: number): { label: string; color: string; bg: string; border: string } {
  if (pct >= 80) return { label: 'Exam-ready', color: '#2DD4BF', bg: 'rgba(45,212,191,0.12)', border: 'rgba(45,212,191,0.3)' }
  if (pct >= 55) return { label: 'On track',   color: '#818CF8', bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.3)' }
  return { label: 'Needs work', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.28)' }
}

const STREAK_TARGETS = [7, 14, 21, 30, 60, 100]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function MomentumClient({ userId }: { userId: string }) {
  // -- Persistent UI state --
  const [balance,      setBalance]      = useState(0)
  const [redeemed,     setRedeemed]     = useState<string[]>([])
  const [isRedeeming,  setIsRedeeming]  = useState(false)
  const [cohortOn,     setCohortOn]     = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('nocturne-cohort') === '1'
    return false
  })

  // -- Momentum data state --
  const [currentStreak,  setCurrentStreak]  = useState(0)
  const [bestStreak,     setBestStreak]     = useState(0)
  const [weekDays,       setWeekDays]       = useState<Array<{ label: string; done: boolean }>>(
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label) => ({ label, done: false })),
  )
  const [heatData,       setHeatData]       = useState<HeatData>(() =>
    buildHeatmapFromActivity([]),
  )
  const [weeklyEarnings, setWeeklyEarnings] = useState(0)
  const [courses,        setCourses]        = useState<CourseData[]>([])
  const [milestones,     setMilestones]     = useState<MilestoneItem[]>([])

  // -- Derived --
  const studiedThisWeek = weekDays.filter((d) => d.done).length
  const nextTarget      = STREAK_TARGETS.find((t) => t > currentStreak) ?? currentStreak + 7
  const milestonesEarned = milestones.filter((m) => m.earned).length

  const redeemItems: RedeemItem[] = useMemo(() => [
    { name: 'Priority transcription', sub: '30 min · skip the queue',     cost: 400,  iconColor: '251,191,36', icon: <BoltIcon size={13} /> },
    { name: '9B ASR boost',           sub: 'Sharper transcripts · 1 lecture', cost: 650,  iconColor: '45,212,191', icon: <WaveIcon size={13} /> },
    { name: '1 week of Pro',          sub: 'Extend your plan',             cost: 1000, iconColor: '99,102,241',  icon: <CrownIcon size={13} /> },
  ], [])

  // -- Load data on mount --
  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - WEEKS_N * 7)
      const sinceStr = since.toISOString().slice(0, 10)
      const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

      const [activityRes, userRes, ledgerRes, earnedRes, taggedRes] = await Promise.all([
        supabase.from('user_activity').select('date, sessions_played, cards_reviewed').gte('date', sinceStr).order('date'),
        supabase.from('users').select('momentum_points').eq('id', userId).single(),
        supabase.from('momentum_ledger').select('delta').gte('created_at', weekAgo.toISOString()).gt('delta', 0),
        supabase.from('user_milestones').select('milestone_id'),
        supabase.from('sessions').select('id, course_tag').not('course_tag', 'is', null),
      ])

      const activityRows = activityRes.data ?? []
      const activeDates  = activityRows
        .filter((r) => (r.sessions_played ?? 0) > 0 || (r.cards_reviewed ?? 0) > 0)
        .map((r) => r.date as string)

      const { current, best } = computeStreaks(activeDates)
      const activitySet = new Set(activeDates)

      const weeklyEarned = (ledgerRes.data ?? []).reduce((s, r) => s + (r.delta as number), 0)
      const earnedIds    = new Set((earnedRes.data ?? []).map((r) => r.milestone_id as string))

      // Course mastery: multi-step query per tag
      const tagGroups: Record<string, string[]> = {}
      for (const s of taggedRes.data ?? []) {
        const t = s.course_tag as string
        if (!tagGroups[t]) tagGroups[t] = []
        tagGroups[t].push(s.id as string)
      }
      const courseResults: CourseData[] = []
      for (const [tag, sIds] of Object.entries(tagGroups)) {
        const { data: fcs } = await supabase.from('flashcards').select('id').in('session_id', sIds)
        const total = fcs?.length ?? 0
        if (total === 0) continue
        const { data: revs } = await supabase
          .from('flashcard_reviews').select('flashcard_id')
          .in('flashcard_id', (fcs ?? []).map((f) => f.id as string))
          .eq('user_id', userId)
        const reviewed = new Set((revs ?? []).map((r) => r.flashcard_id as string)).size
        courseResults.push({ name: tag, pct: Math.round((reviewed / total) * 100), done: reviewed, total })
      }
      courseResults.sort((a, b) => b.pct - a.pct)

      // Milestone progress counts
      const [{ count: sessionCount }, { count: cardCount }] = await Promise.all([
        supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('flashcard_reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      ])

      setBalance((userRes.data?.momentum_points as number | null) ?? 0)
      setCurrentStreak(current)
      setBestStreak(best)
      setWeekDays(buildWeekDays(activitySet))
      setHeatData(buildHeatmapFromActivity(activityRows as { date: string; sessions_played: number; cards_reviewed: number }[]))
      setWeeklyEarnings(weeklyEarned)
      setCourses(courseResults)
      setMilestones(buildMilestoneItems(earnedIds, current, sessionCount ?? 0, cardCount ?? 0, courseResults))
    }

    load().catch(console.error)
  }, [userId])

  function toggleCohort() {
    const next = !cohortOn
    setCohortOn(next)
    localStorage.setItem('nocturne-cohort', next ? '1' : '0')
  }

  async function redeem(name: string, cost: number) {
    if (balance < cost || redeemed.includes(name) || isRedeeming) return
    setIsRedeeming(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.rpc('redeem_momentum', { p_cost: cost, p_reason: `redeem:${name}` })
      const result = (data as Array<{ success: boolean; new_balance: number }> | null)?.[0]
      if (result?.success) {
        setBalance(result.new_balance)
        setRedeemed((r) => [...r, name])
      }
    } catch (e) {
      console.error('[Momentum] redeem error:', e)
    } finally {
      setIsRedeeming(false)
    }
  }

  const cohortGlyphs = ['A', 'K', 'J', 'R', '+9']

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 40px 90px' }}>

      {/* ==============================
          Section 1: Header
          ============================== */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
            <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', color: '#E2E8F0', margin: 0 }}>
              Momentum
            </h1>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '3px 9px', borderRadius: 9999,
              border: '1px solid rgba(251,191,36,0.3)',
              background: 'rgba(251,191,36,0.12)',
              fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: '#FBBF24',
            }}>
              Beta
            </span>
          </div>
          <p style={{ fontSize: 13, color: '#5B6478', margin: 0, fontFamily: 'var(--font-mono, monospace)' }}>
            computed on your device
          </p>
        </div>

        {/* Momentum balance chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          padding: '9px 15px', borderRadius: 12,
          border: '1px solid rgba(251,191,36,0.28)',
          background: 'rgba(251,191,36,0.07)',
        }}>
          <span style={{ color: '#FBBF24', display: 'flex' }}><BoltIcon size={17} /></span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#FCD34D', lineHeight: 1, fontFamily: 'var(--font-mono, monospace)' }}>
              {balance.toLocaleString()}
            </div>
            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 3 }}>momentum</div>
          </div>
        </div>
      </div>

      {/* ==============================
          Section 2: Streak hero band
          ============================== */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        marginTop: 20,
        border: '1px solid rgba(251,191,36,0.25)',
        borderRadius: 18,
        background: 'linear-gradient(120deg, rgba(251,191,36,0.14) 0%, rgba(244,63,94,0.08) 50%, rgba(13,13,20,0.5) 100%)',
      }}>
        <div style={{
          position: 'absolute', top: '-50%', left: '-3%',
          width: 380, height: 300,
          background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.16) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 34,
          padding: '28px 32px', flexWrap: 'wrap',
        }}>
          {/* Big streak */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              width: 66, height: 66, flexShrink: 0, borderRadius: 18,
              background: 'radial-gradient(circle at 50% 30%, rgba(251,191,36,0.3), rgba(244,63,94,0.12))',
              border: '1px solid rgba(251,191,36,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FBBF24',
              animation: 'noct-flame 2.4s ease-in-out infinite',
            }}>
              <FlameIcon size={30} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 46, fontWeight: 700, letterSpacing: '-0.03em', color: '#FCD34D', lineHeight: 1, fontFamily: 'var(--font-mono, monospace)' }}>
                  {currentStreak}
                </span>
                <span style={{ fontSize: 14, color: '#94A3B8' }}>day streak</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#5B6478', marginTop: 6 }}>
                Personal best{' '}
                <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{bestStreak} days</span>
              </div>
              <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>
                {studiedThisWeek} / 7 days this week
              </div>
            </div>
          </div>

          {/* 7-day dot strip */}
          <div style={{ display: 'flex', gap: 9, paddingLeft: 6 }}>
            {weekDays.map((d, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                <span style={d.done ? {
                  width: 26, height: 26, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(145deg,#FBBF24,#F59E0B)',
                  boxShadow: '0 0 12px rgba(251,191,36,0.5)',
                } : {
                  width: 26, height: 26, borderRadius: 8,
                  border: '1.5px dashed #2D2B45',
                  background: '#0D0D14',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {d.done && <CheckIcon />}
                </span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: '#5B6478' }}>
                  {d.label}
                </span>
              </div>
            ))}
          </div>

          {/* Next milestone */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: '#5B6478', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Next milestone:{' '}
                <span style={{ color: '#FCD34D', fontWeight: 500 }}>{nextTarget}-day streak</span>
              </span>
              <span style={{ fontSize: 11.5, color: '#5B6478', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>
                {currentStreak} / {nextTarget}
              </span>
            </div>
            <div style={{ height: 6, width: '100%', borderRadius: 9999, background: '#16151F', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(Math.min(currentStreak / nextTarget, 1) * 100)}%`,
                borderRadius: 9999,
                background: 'linear-gradient(90deg,#FBBF24,#F59E0B)',
                transition: 'width .5s',
              }} />
            </div>
            <div style={{ fontSize: 11.5, color: '#5B6478', marginTop: 8 }}>
              {nextTarget - currentStreak} more day{nextTarget - currentStreak !== 1 ? 's' : ''} to unlock the {nextTarget}-day streak badge
            </div>
          </div>
        </div>
      </div>

      {/* ==============================
          Section 3: Heatmap + Wallet (1.55fr 1fr)
          ============================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 16, marginTop: 14 }}>

        {/* ----- Study activity heatmap ----- */}
        <div style={{ borderRadius: 14, border: '1px solid #1E1E2E', background: '#0C0C13', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>Study activity</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#3F485C', marginTop: 2 }}>
                {heatData.activeDays} active days · {WEEKS_N} weeks
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: '#3F485C' }}>Less</span>
              {HEATMAP_SCALE.map((c, i) => (
                <span key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block' }} />
              ))}
              <span style={{ fontSize: 10, color: '#3F485C' }}>More</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 18, marginRight: 3 }}>
              {['M', '', 'W', '', 'F', '', ''].map((label, i) => (
                <span key={i} style={{ height: 14, fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: '#3F485C', lineHeight: '14px', display: 'block' }}>
                  {label}
                </span>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              {/* Month labels */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
                {heatData.monthDefs.map(([label, wIdx], mi) => {
                  const prevIdx = mi > 0 ? heatData.monthDefs[mi - 1]![1] : 0
                  const gap = mi === 0 ? 0 : (wIdx - prevIdx - 1) * 18
                  return (
                    <span key={`${label}-${mi}`} style={{
                      fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
                      color: '#3F485C', whiteSpace: 'nowrap',
                      marginLeft: mi === 0 ? 0 : gap,
                    }}>
                      {label}
                    </span>
                  )
                })}
              </div>

              {/* Grid: columns = weeks, rows = days */}
              <div style={{ display: 'flex', gap: 3 }}>
                {heatData.weeks.map((week, wi) => (
                  <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {week.days.map((cell, di) => (
                      <span
                        key={di}
                        title={cell.title}
                        style={{
                          width: 14, height: 14, borderRadius: 3,
                          background: HEATMAP_SCALE[cell.lvl],
                          display: 'block',
                          cursor: 'default',
                          transition: 'transform .14s, filter .14s',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.28)'
                          ;(e.currentTarget as HTMLElement).style.filter = 'brightness(1.3)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLElement).style.transform = 'none'
                          ;(e.currentTarget as HTMLElement).style.filter = 'none'
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ----- Momentum wallet ----- */}
        <div style={{
          borderRadius: 14, border: '1px solid rgba(251,191,36,0.2)',
          background: 'rgba(251,191,36,0.05)',
          padding: '22px 24px',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5B6478' }}>
            Momentum wallet
          </div>

          <div style={{ fontSize: 34, fontWeight: 600, fontFamily: 'var(--font-mono, monospace)', color: '#FCD34D', marginTop: 10, lineHeight: 1 }}>
            {balance.toLocaleString()}
          </div>
          <div style={{ fontSize: 11.5, color: '#FBBF24', marginTop: 5 }}>
            earned this week: +{weeklyEarnings.toLocaleString()}
          </div>

          <div style={{ height: 1, background: 'rgba(251,191,36,0.12)', margin: '14px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
            {redeemItems.map((item) => {
              const canAfford = balance >= item.cost
              const alreadyRedeemed = redeemed.includes(item.name)
              const enabled = canAfford && !alreadyRedeemed && !isRedeeming
              return (
                <div key={item.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: '#0B0B11',
                  opacity: enabled ? 1 : 0.5,
                  cursor: enabled ? 'pointer' : 'not-allowed',
                  transition: 'opacity .2s',
                }}
                  onClick={() => redeem(item.name, item.cost)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{
                      width: 28, height: 28, flexShrink: 0, borderRadius: 7,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `rgba(${item.iconColor},0.12)`,
                      border: `1px solid rgba(${item.iconColor},0.26)`,
                      color: `rgb(${item.iconColor})`,
                    }}>
                      {item.icon}
                    </span>
                    <span style={{ fontSize: 12.5, color: '#E2E8F0', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {alreadyRedeemed ? `✓ ${item.name}` : item.name}
                    </span>
                  </div>
                  <span style={{
                    flexShrink: 0, fontSize: 12, fontWeight: 600,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: alreadyRedeemed ? '#2DD4BF' : enabled ? '#FBBF24' : '#5B6478',
                    padding: '3px 7px', borderRadius: 8,
                    background: `rgba(251,191,36,0.12)`,
                  }}>
                    {alreadyRedeemed ? 'Done' : `${item.cost.toLocaleString()} ⚡`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ==============================
          Section 4: Mastery by subject
          ============================== */}
      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', marginBottom: 14 }}>
          Mastery by subject
        </div>
        {courses.length === 0 ? (
          <div style={{
            padding: '32px 24px', borderRadius: 14,
            border: '1px solid #1E1E2E', background: '#0C0C13',
            textAlign: 'center', color: '#3F485C', fontSize: 13,
          }}>
            Tag sessions with a subject to track mastery by course
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {courses.map((course) => {
              const tag = masteryTag(course.pct)
              const deg = Math.round(course.pct * 3.6)
              return (
                <div key={course.name} style={{
                  borderRadius: 14, border: '1px solid #1E1E2E', background: '#0C0C13',
                  padding: 22, textAlign: 'center',
                }}>
                  <div style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: `conic-gradient(#6366F1 0deg, #6366F1 ${deg}deg, #16151F ${deg}deg, #16151F 360deg)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto', position: 'relative',
                  }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: '50%',
                      background: '#0C0C13',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', fontFamily: 'var(--font-mono, monospace)' }}>
                        {course.pct}%
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', margin: '12px 0 4px' }}>
                    {course.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#5B6478', marginBottom: 10 }}>
                    {course.done} / {course.total} keywords
                  </div>

                  <span style={{
                    display: 'inline-flex', alignItems: 'center',
                    padding: '4px 10px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 500,
                    color: tag.color, background: tag.bg,
                    border: `1px solid ${tag.border}`,
                  }}>
                    {tag.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ==============================
          Section 5: Milestones + Course circle (1fr 1fr)
          ============================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>

        {/* ----- Milestones ----- */}
        <div style={{ borderRadius: 14, border: '1px solid #1E1E2E', background: '#0C0C13', padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>Milestones</div>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono, monospace)', color: '#5B6478' }}>
              {milestonesEarned} earned
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {milestones.map((m, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 12px', borderRadius: 12,
                border: `1px solid ${m.earned ? `rgba(${m.color},0.22)` : '#16151F'}`,
                background: m.earned ? `rgba(${m.color},0.05)` : '#0B0B11',
              }}>
                <span style={{
                  width: 30, height: 30, flexShrink: 0, borderRadius: 9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `rgba(${m.color},${m.earned ? '0.14' : '0.08'})`,
                  border: `1px solid rgba(${m.color},${m.earned ? '0.3' : '0.18'})`,
                  color: m.earned ? `rgb(${m.color})` : '#5B6478',
                  opacity: m.earned ? 1 : 0.7,
                }}>
                  {m.icon}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: m.earned ? '#E2E8F0' : '#CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5B6478' }}>{m.sub}</div>
                </div>

                {m.earned ? (
                  <span style={{ color: '#2DD4BF', display: 'flex', flexShrink: 0 }}>
                    <CheckCircleIcon size={16} />
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: '#5B6478', fontFamily: 'var(--font-mono, monospace)', flexShrink: 0 }}>
                    {m.progress}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ----- Course circle ----- */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          borderRadius: 14,
          border: '1px solid rgba(99,102,241,0.2)',
          background: 'rgba(99,102,241,0.05)',
          padding: '22px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0' }}>Course circle</div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 8px', borderRadius: 9999,
                  border: '1px solid rgba(129,140,248,0.3)',
                  background: 'rgba(99,102,241,0.1)',
                  fontSize: 10, color: '#A5B4FC',
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#818CF8', display: 'inline-block' }} />
                  Opt-in
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#5B6478', marginTop: 3 }}>BIBC 102 · Biochemistry</div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={cohortOn}
              onClick={toggleCohort}
              style={{
                width: 40, height: 23, flexShrink: 0, borderRadius: 9999,
                border: 'none', padding: 2, cursor: 'pointer',
                background: cohortOn ? '#6366F1' : '#2D2B45',
                display: 'flex',
                justifyContent: cohortOn ? 'flex-end' : 'flex-start',
                alignItems: 'center',
                transition: 'background .2s',
              }}
            >
              <span style={{ width: 19, height: 19, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
            </button>
          </div>

          {cohortOn ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <div style={{ display: 'flex' }}>
                  {cohortGlyphs.map((g, i) => (
                    <span key={i} style={{
                      width: 26, height: 26,
                      marginLeft: i === 0 ? 0 : -8,
                      borderRadius: '50%',
                      border: '2px solid #0C0C13',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: g.length > 1 ? 9 : 11, fontWeight: 600,
                      color: g.length > 1 ? '#A5B4FC' : '#09090F',
                      background: g.length > 1 ? '#16151F' : 'linear-gradient(145deg,#6366F1,#8B5CF6)',
                    }}>
                      {g}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 12.5, color: '#94A3B8' }}>
                  <span style={{ color: '#E2E8F0', fontWeight: 600 }}>14 classmates</span> reviewing for Midterm 2
                </div>
              </div>

              <div style={{ marginTop: 16, border: '1px solid #1A1A26', borderRadius: 12, background: '#0B0B11', padding: '14px 15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: '#E2E8F0' }}>Shared exam-prediction deck</span>
                  <span style={{ fontSize: 10.5, color: '#FB7185', fontWeight: 500 }}>Midterm 2</span>
                </div>
                <div style={{ fontSize: 11.5, color: '#5B6478', marginBottom: 12 }}>
                  47 predicted keywords · pooled anonymously from 14 vaults
                </div>
                <button
                  type="button"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    height: 34, padding: '0 14px', borderRadius: 9,
                    background: '#6366F1', color: '#09090F',
                    fontSize: 12.5, fontWeight: 500,
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  <DownloadIcon size={13} />
                  Add to my vault
                </button>
              </div>

              <a
                href="/community"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  marginTop: 12, padding: '11px 14px', borderRadius: 12,
                  border: '1px solid #1A1A26', background: '#0B0B11',
                  textDecoration: 'none',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{
                    width: 28, height: 28, flexShrink: 0, borderRadius: 8,
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8',
                  }}>
                    <PeopleIcon size={14} />
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#E2E8F0', fontWeight: 500 }}>Open the full course room →</span>
                    <span style={{ display: 'block', fontSize: 11, color: '#5B6478' }}>Pooled keywords, threads &amp; decks in Community</span>
                  </span>
                </span>
                <span style={{ color: '#818CF8', display: 'flex', flexShrink: 0 }}>
                  <ArrowRightIcon size={14} />
                </span>
              </a>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
                <span style={{ color: '#818CF8', display: 'flex', flexShrink: 0 }}><LockIcon size={13} /></span>
                <span style={{ fontSize: 11, color: '#5B6478', lineHeight: 1.45 }}>
                  Your name never appears. Only keyword counts are pooled.
                </span>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 18, textAlign: 'center', padding: '18px 10px 8px' }}>
              <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.55, marginBottom: 4 }}>
                Join your course circle to see pooled exam predictions
              </div>
              <div style={{ fontSize: 11.5, color: '#5B6478' }}>
                Anonymous &amp; encrypted — switch on any time.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
