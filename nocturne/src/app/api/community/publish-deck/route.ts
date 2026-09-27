// POST /api/community/publish-deck
//
// Publishes a session's flashcards to a community room as a plaintext deck.
// Gated behind Eclipse tier.
//
// PRIVACY CONTRACT: the request body carries pre-decrypted card content.
// That content is stored in plaintext in community_decks / community_deck_cards
// — this is intentional and explicitly consented to by the user before publish.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { hasAccess, type Tier } from '@/lib/tiers/features'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

interface PublishBody {
  sessionId: string
  roomId:    string
  title:     string
  cards:     Array<{ front: string; back: string; zone: 'red' | 'likely' }>
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Tier gate ─────────────────────────────────────────────────────────────────
  const { data: subRow } = await supabase
    .from('subscriptions').select('tier').eq('user_id', user.id).maybeSingle()
  const userTier = (subRow?.tier ?? 'dusk') as Tier
  if (!hasAccess(userTier, 'eclipse')) {
    return NextResponse.json({ error: 'Requires Eclipse plan', code: 'tier_required' }, { status: 403 })
  }

  // ── Parse body ────────────────────────────────────────────────────────────────
  let body: PublishBody
  try {
    body = await request.json() as PublishBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { sessionId, roomId, title, cards } = body

  if (!sessionId || !roomId || !title?.trim()) {
    return NextResponse.json({ error: 'sessionId, roomId, and title are required' }, { status: 400 })
  }
  if (!Array.isArray(cards) || cards.length === 0) {
    return NextResponse.json({ error: 'cards array must be non-empty' }, { status: 400 })
  }

  // ── Verify session ownership ──────────────────────────────────────────────────
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!sessionRow) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Publish via SECURITY DEFINER (membership check inside) ───────────────────
  const { data: deckId, error } = await supabase.rpc('publish_community_deck', {
    p_room_id:    roomId,
    p_session_id: sessionId,
    p_title:      title.trim(),
    p_cards:      cards,
  })

  if (error || !deckId) {
    console.error('[publish-deck] rpc error:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Not a room member or publish failed' },
      { status: error ? 500 : 403 },
    )
  }

  return NextResponse.json({ deckId })
}
