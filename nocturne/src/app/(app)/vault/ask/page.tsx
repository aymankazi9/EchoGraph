import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { getUserTier } from '@/lib/tiers/server'
import { hasAccess } from '@/lib/tiers/features'
import { LockedFeature } from '@/components/paywall/locked-feature'
import { VaultAskClient, type RawSession } from '@/components/vault-ask/vault-ask-client'

export const metadata = { title: 'Vault Ask — Nocturne' }

export default async function VaultAskPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [userTier, { data: sessions }] = await Promise.all([
    getUserTier(supabase, user.id),

    // Fetch all sessions: encrypted title + course info for Stage 1 scoring.
    // Full transcript/slide content is fetched client-side only for the top-K
    // sessions selected by Stage 1 — never fetched for the whole vault.
    supabase
      .from('sessions')
      .select('id, title_encrypted, course_id, courses(name), status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  // Tier gate — show a locked state rather than hiding the nav item entirely.
  if (!hasAccess(userTier, 'eclipse')) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-8">
        <h1 className="text-heading font-medium text-text-primary mb-1">Vault Ask</h1>
        <p className="text-body-sm text-text-secondary mb-8">
          Ask questions across all your lectures at once.
        </p>
        <div className="flex" style={{ height: 400 }}>
          <LockedFeature
            requiredTier="eclipse"
            feature="Vault Ask"
            description="Ask questions that span your entire vault — Nocturne automatically selects the most relevant lectures and cites which session and slide each answer comes from."
          />
        </div>
      </div>
    )
  }

  const sessionList = (sessions ?? []) as unknown as RawSession[]

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 64px)', maxWidth: 800, margin: '0 auto', width: '100%', padding: '24px 24px 0' }}
    >
      {/* Page header */}
      <div style={{ flexShrink: 0, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#E2E8F0', margin: 0, letterSpacing: '-0.02em' }}>
          Vault Ask
        </h1>
        <p style={{ fontSize: 13, color: '#5B6478', margin: '4px 0 0' }}>
          Ask across all your lectures — relevant sessions are selected automatically.
        </p>
      </div>

      {/* Chat fills remaining space */}
      <div style={{ flex: 1, minHeight: 0, paddingBottom: 24 }}>
        <VaultAskClient userId={user.id} sessions={sessionList} />
      </div>
    </div>
  )
}
