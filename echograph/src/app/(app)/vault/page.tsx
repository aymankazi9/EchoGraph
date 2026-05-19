import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { VaultDashboardClient } from '@/components/dashboard/vault-dashboard-client'

export default async function VaultPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch sessions + keyword red-zone counts + slide counts + file sizes in parallel
  const [{ data: sessions }, { data: kwRows }, { data: slideRows }, { data: profile }, { data: fileRows }] =
    await Promise.all([
      supabase
        .from('sessions')
        .select('id, title_encrypted, has_slides, has_audio, has_study_guide, guide_type, status, created_at')
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
        .select('storage_used_bytes')
        .eq('id', user.id)
        .single(),

      supabase
        .from('files')
        .select('session_id, size_bytes')
        .eq('user_id', user.id),
    ])

  // Build count maps
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

  const usedBytes = profile?.storage_used_bytes ?? 0
  const storageMB = usedBytes / (1024 * 1024)

  return (
    <VaultDashboardClient
      sessions={sessions ?? []}
      redZoneCounts={redZoneCounts}
      slideCounts={slideCounts}
      fileSizeBytes={fileSizeBytes}
      storageMB={storageMB}
      sessionCount={sessions?.length ?? 0}
    />
  )
}
