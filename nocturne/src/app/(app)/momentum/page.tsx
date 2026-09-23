import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { getUserTier } from '@/lib/tiers/server'
import { MomentumClient } from './MomentumClient'

export const metadata = { title: 'Momentum · Nocturne' }

export default async function MomentumPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const userTier = await getUserTier(supabase, user.id)
  return <MomentumClient userId={user.id} userTier={userTier} />
}
