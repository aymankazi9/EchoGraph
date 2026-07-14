import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { MomentumClient } from './MomentumClient'

export const metadata = { title: 'Momentum · Nocturne' }

export default async function MomentumPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <MomentumClient userId={user.id} />
}
