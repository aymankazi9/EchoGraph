import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { CommunityClient } from './CommunityClient'

export const metadata = { title: 'Community · Nocturne' }

export default async function CommunityPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <CommunityClient userId={user.id} />
}
