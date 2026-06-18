import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { NewSessionClient } from './NewSessionClient'

export default async function NewSessionPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <NewSessionClient userId={user.id} />
}
