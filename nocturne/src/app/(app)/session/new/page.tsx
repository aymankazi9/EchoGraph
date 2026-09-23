import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { getUserTier } from '@/lib/tiers/server'
import { STORAGE_CAPS_BYTES } from '@/lib/tiers/features'
import { NewSessionClient } from './NewSessionClient'

export default async function NewSessionPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [userTier, { data: storageBytesRaw }] = await Promise.all([
    getUserTier(supabase, user.id),
    supabase.rpc('get_user_storage_bytes', { p_user_id: user.id }),
  ])

  const storageBytesUsed = (storageBytesRaw as number) ?? 0
  const storageCapBytes = STORAGE_CAPS_BYTES[userTier]

  return (
    <NewSessionClient
      userId={user.id}
      storageBytesUsed={storageBytesUsed}
      storageCapBytes={storageCapBytes}
    />
  )
}
