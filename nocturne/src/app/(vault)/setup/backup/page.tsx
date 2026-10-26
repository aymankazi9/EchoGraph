import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { BackupClient } from './BackupClient'

export const metadata = { title: 'Recovery Kit — Nocturne', robots: { index: false, follow: false } }

export default async function BackupPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <BackupClient userId={user.id} />
}
