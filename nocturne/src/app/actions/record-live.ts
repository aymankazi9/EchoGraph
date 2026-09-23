'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getUserTier } from '@/lib/tiers/server'
import { hasAccess } from '@/lib/tiers/features'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Server-authoritative tier gate for Record Live.
 *
 * Call this before `addFilesToExistingSession` for audio blobs so that a
 * Dusk-tier user gets a clean, typed rejection instead of an opaque storage
 * RLS error. Throws `TierRequiredError` when the check fails; returns void on
 * success. Idempotent — safe to call multiple times per request.
 */
export async function assertCanRecordLive(): Promise<void> {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {}, // read-only — server actions don't need to refresh tokens here
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')

  const tier = await getUserTier(supabase, user.id)
  if (!hasAccess(tier, 'midnight')) {
    const err = new Error('Record Live requires Midnight plan or above') as Error & { code: string }
    err.code = 'tier_required'
    throw err
  }
}
