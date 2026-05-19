import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { SetupForm } from './SetupForm'

export default async function SetupPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('pbkdf2_salt')
    .eq('id', user.id)
    .single()

  // Already set up — go to unlock instead
  if (profile?.pbkdf2_salt) redirect('/unlock')

  return <SetupForm userId={user.id} />
}
