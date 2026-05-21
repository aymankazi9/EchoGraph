import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { AppShell } from '@/components/nav/app-shell'
import { InstallBanner } from '@/components/pwa/install-banner'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('pbkdf2_salt, storage_used_bytes')
    .eq('id', user.id)
    .single()

  // No vault setup yet → run through onboarding
  if (!profile?.pbkdf2_salt) redirect('/setup')

  const usedBytes = profile?.storage_used_bytes ?? 0

  return (
    <>
      <AppShell email={user.email ?? ''} usedBytes={usedBytes}>
        {children}
      </AppShell>
      <InstallBanner navOffset />
    </>
  )
}
