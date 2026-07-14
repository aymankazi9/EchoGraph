import { createServerClient } from '@/lib/supabase-server'
import { SetupForm } from './SetupForm'
import { redirect } from 'next/navigation'

export default async function SetupPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Already fully set up — send to unlock
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('pbkdf2_salt')
      .eq('id', user.id)
      .single()

    if (profile?.pbkdf2_salt) redirect('/unlock')
  }

  // Authenticated but not set up → skip account-creation step
  // Unauthenticated → show from the beginning (Step 0: create account)
  return <SetupForm userId={user?.id ?? ''} initialStep={user ? 1 : 0} />
}
