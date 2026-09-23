import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { VaultDashboardClient } from '@/components/dashboard/vault-dashboard-client'
import type { ContinueSessionData } from '@/components/dashboard/continue-card'
import type { VaultStats } from '@/components/dashboard/stat-tiles'

// Streak from consecutive user_activity dates (same algorithm as momentum-ribbon).
function computeCurrentStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort()
  const lastDt = new Date(sorted[sorted.length - 1]!)
  lastDt.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (lastDt < yesterday) return 0
  let streak = 1
  for (let i = sorted.length - 2; i >= 0; i--) {
    const diff = Math.round(
      (new Date(sorted[i + 1]!).getTime() - new Date(sorted[i]!).getTime()) / 86400000,
    )
    if (diff === 1) streak++
    else break
  }
  return streak
}

export default async function VaultPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all data in parallel.
  // users.storage_used_bytes is never written; get_user_storage_bytes() is the source of truth.
  const [
    { data: sessions },
    { data: kwRows },
    { data: slideRows },
    { data: profile },
    { data: fileRows },
    { data: storageBytesRaw },
    { data: activityRows },
    { data: exportRows },
    { data: playbackRows },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('id, title_encrypted, has_slides, has_audio, has_study_guide, guide_type, status, created_at, last_opened_at, course_tag')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('keywords')
      .select('session_id')
      .eq('user_id', user.id)
      .eq('zone', 'red'),

    // RLS on slides is via session_id FK → no user_id column on the table
    supabase
      .from('slides')
      .select('session_id'),

    supabase
      .from('users')
      .select('checklist_dismissed, checklist_completed, checklist_exported')
      .eq('id', user.id)
      .single(),

    supabase
      .from('files')
      .select('session_id, size_bytes')
      .eq('user_id', user.id),

    // Accurate byte total across all encrypted content columns
    supabase.rpc('get_user_storage_bytes', { p_user_id: user.id }),

    // Activity dates for streak computation (last 17 weeks)
    supabase
      .from('user_activity')
      .select('date')
      .gte('date', new Date(Date.now() - 17 * 7 * 86400000).toISOString().slice(0, 10))
      .order('date'),

    // Lifetime Anki export history
    supabase
      .from('export_events')
      .select('card_count'),

    // Audio playback positions — used for "continue studying" progress bar
    supabase
      .from('sessions_playback')
      .select('session_id, last_position_ms'),
  ])

  // ── Count maps ──────────────────────────────────────────────────────────────

  const redZoneCounts: Record<string, number> = {}
  for (const row of kwRows ?? []) {
    redZoneCounts[row.session_id] = (redZoneCounts[row.session_id] ?? 0) + 1
  }

  const slideCounts: Record<string, number> = {}
  for (const row of slideRows ?? []) {
    slideCounts[row.session_id] = (slideCounts[row.session_id] ?? 0) + 1
  }

  const fileSizeBytes: Record<string, number> = {}
  for (const row of fileRows ?? []) {
    fileSizeBytes[row.session_id] = (fileSizeBytes[row.session_id] ?? 0) + (row.size_bytes ?? 0)
  }

  const playbackBySession: Record<string, number> = {}
  for (const row of playbackRows ?? []) {
    playbackBySession[row.session_id as string] = row.last_position_ms as number
  }

  // ── Stat tile computations ─────────────────────────────────────────────────

  const sessionList = sessions ?? []
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const sessionsThisWeek = sessionList.filter((s) => s.created_at >= sevenDaysAgo).length

  const activeDates = (activityRows ?? [])
    .filter((r) => r.date)
    .map((r) => r.date as string)
  const studyStreak = computeCurrentStreak(activeDates)

  const cardsExported = (exportRows ?? []).reduce((sum, r) => sum + ((r.card_count as number) ?? 0), 0)

  const stats: VaultStats = {
    redZoneTotal: kwRows?.length ?? 0,
    sessionCount: sessionList.length,
    sessionsThisWeek,
    studyStreak,
    cardsExported,
  }

  // ── Continue studying card ─────────────────────────────────────────────────
  // Prefer sessions with audio, sorted by last_opened_at DESC (NULLS LAST = created_at fallback).

  let continueSession: ContinueSessionData | null = null
  if (sessionList.length > 0) {
    const sorted = [...sessionList].sort((a, b) => {
      const aTime = a.last_opened_at ?? a.created_at
      const bTime = b.last_opened_at ?? b.created_at
      return bTime.localeCompare(aTime)
    })
    // Prefer sessions that have audio (can resume playback)
    const candidate = sorted.find((s) => s.has_audio) ?? sorted[0]!
    continueSession = {
      id: candidate.id,
      title_encrypted: candidate.title_encrypted,
      course_tag: (candidate.course_tag as string | null) ?? null,
      last_opened_at: (candidate.last_opened_at as string | null) ?? null,
      last_position_ms: playbackBySession[candidate.id] ?? null,
      slide_count: slideCounts[candidate.id] ?? 0,
      red_zone_count: redZoneCounts[candidate.id] ?? 0,
    }
  }

  const storageBytes = (storageBytesRaw as number | null) ?? 0

  return (
    <VaultDashboardClient
      userId={user.id}
      sessions={sessionList}
      redZoneCounts={redZoneCounts}
      slideCounts={slideCounts}
      fileSizeBytes={fileSizeBytes}
      storageBytes={storageBytes}
      sessionCount={sessionList.length}
      checklistDismissed={profile?.checklist_dismissed ?? false}
      checklistCompleted={profile?.checklist_completed ?? false}
      checklistExported={profile?.checklist_exported ?? false}
      continueSession={continueSession}
      stats={stats}
    />
  )
}
