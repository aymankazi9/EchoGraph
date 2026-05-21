import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { UnlockForm } from './UnlockForm'

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('pbkdf2_salt, encrypted_master_key, recovery_salt')
    .eq('id', user.id)
    .single()

  // No vault set up yet — send to setup
  if (!profile?.pbkdf2_salt || !profile?.encrypted_master_key) redirect('/setup')

  return (
    <UnlockForm
      salt={profile.pbkdf2_salt}
      wrappedKey={profile.encrypted_master_key}
      recoverySalt={profile.recovery_salt ?? null}
      next={next ?? null}
    />
  )
}
