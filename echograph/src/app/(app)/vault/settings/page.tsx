import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { Separator } from '@/components/ui/separator'
import { AccountSection } from '@/components/settings/account-section'
import { PreferencesSection } from '@/components/settings/preferences-section'
import { StorageSection } from '@/components/settings/storage-section'
import { SecuritySection } from '@/components/settings/security-section'
import { DangerZone } from '@/components/settings/danger-zone'

export default async function SettingsPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch user profile + session storage breakdown in parallel
  const [{ data: profile }, { data: fileRows }] = await Promise.all([
    supabase
      .from('users')
      .select(
        'pbkdf2_salt, encrypted_master_key, recovery_salt, field, tier, storage_used_bytes, silence_threshold_ms, created_at',
      )
      .eq('id', user.id)
      .single(),

    // Files grouped by session — aggregate in JS for top-5 by size
    supabase
      .from('files')
      .select('session_id, size_bytes')
      .eq('user_id', user.id),
  ])

  if (!profile?.pbkdf2_salt) redirect('/setup')

  // Compute session storage totals
  const sessionSizeMap: Record<string, number> = {}
  for (const f of fileRows ?? []) {
    sessionSizeMap[f.session_id] = (sessionSizeMap[f.session_id] ?? 0) + (f.size_bytes ?? 0)
  }

  // Fetch title_encrypted for the top-5 sessions by size
  const topSessionIds = Object.entries(sessionSizeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id)

  const { data: topSessions } = topSessionIds.length
    ? await supabase
        .from('sessions')
        .select('id, title_encrypted')
        .in('id', topSessionIds)
    : { data: [] }

  const sessionBreakdown = (topSessions ?? []).map((s) => ({
    id: s.id,
    title_encrypted: s.title_encrypted,
    total_mb: (sessionSizeMap[s.id] ?? 0) / (1024 * 1024),
  }))

  return (
    <div className="max-w-[640px] mx-auto px-6 py-8">
      <h1 className="text-heading font-medium text-text-primary">Settings</h1>
      <p className="text-body-sm text-text-secondary mt-1 mb-8">
        Manage your vault, account, and preferences.
      </p>

      <div className="flex flex-col gap-8">
        <AccountSection
          email={user.email ?? ''}
          createdAt={profile.created_at ?? user.created_at}
          tier={profile.tier}
        />

        <Separator className="bg-border-subtle" />

        <PreferencesSection
          userId={user.id}
          initialField={profile.field}
          initialSilenceMs={profile.silence_threshold_ms ?? 1500}
          tier={profile.tier}
        />

        <Separator className="bg-border-subtle" />

        <StorageSection
          usedBytes={profile.storage_used_bytes ?? 0}
          tier={profile.tier}
          sessionBreakdown={sessionBreakdown}
        />

        <Separator className="bg-border-subtle" />

        <SecuritySection
          userId={user.id}
          pbkdf2Salt={profile.pbkdf2_salt}
          encryptedMasterKey={profile.encrypted_master_key ?? ''}
          recoverySalt={profile.recovery_salt ?? null}
        />

        <Separator className="bg-border-subtle" />

        <DangerZone
          userId={user.id}
          pbkdf2Salt={profile.pbkdf2_salt}
          encryptedMasterKey={profile.encrypted_master_key ?? ''}
        />
      </div>
    </div>
  )
}
