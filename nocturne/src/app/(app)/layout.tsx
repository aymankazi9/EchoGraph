import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { getUserTier } from '@/lib/tiers/server'
import { AppShell } from '@/components/nav/app-shell'
import { InstallBanner } from '@/components/pwa/install-banner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: usedBytesRaw }, userTier, { data: subRow }] = await Promise.all([
    supabase
      .from('users')
      .select('pbkdf2_salt')
      .eq('id', user.id)
      .single(),

    // Real byte count across all encrypted content — users.storage_used_bytes is never
    // written by any upload path and is always 0; this function is the source of truth.
    supabase.rpc('get_user_storage_bytes', { p_user_id: user.id }),

    getUserTier(supabase, user.id),

    // Subscription status for the past-due banner.
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
  ])

  // No vault setup yet → run through onboarding
  if (!profile?.pbkdf2_salt) redirect('/setup')

  const usedBytes = (usedBytesRaw as number | null) ?? 0
  const pastDue = subRow?.status === 'past_due'

  return (
    <>
      <AppShell email={user.email ?? ''} usedBytes={usedBytes} tier={userTier} pastDue={pastDue}>
        {children}
      </AppShell>
      <InstallBanner navOffset />
    </>
  )
}
