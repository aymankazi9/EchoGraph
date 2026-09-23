import type { SupabaseClient } from '@supabase/supabase-js'
import type { Tier } from './features'

// Pass the already-created server Supabase client to avoid spinning up a second one.
export async function getUserTier(supabase: SupabaseClient, userId: string): Promise<Tier> {
  const { data } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle()
  return (data?.tier as Tier | null) ?? 'dusk'
}
