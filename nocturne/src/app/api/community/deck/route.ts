// GET  /api/community/deck?roomId=…  — fetch the latest deck for a room.
//   Prefers community_decks (new, normalized, zone-per-card).
//   Falls back to shared_decks (legacy, jsonb terms) if no community_deck exists.
// POST /api/community/deck           — publish a legacy shared_deck (kept for compat).

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function makeClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })
}

interface DeckTerm { front: string; back: string; zone: 'red' | 'likely' }
interface DeckResponse {
  deck_id: string
  title: string
  terms: DeckTerm[]
  published_at: string
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = makeClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roomId = request.nextUrl.searchParams.get('roomId')
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  // ── Prefer community_decks (new format) ──────────────────────────────────────
  const { data: communityDeck } = await supabase
    .from('community_decks')
    .select('id, title, created_at, community_deck_cards(id, front, back, zone)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (communityDeck) {
    const cards = (communityDeck.community_deck_cards ?? []) as { front: string; back: string; zone: string }[]
    const deck: DeckResponse = {
      deck_id:      communityDeck.id as string,
      title:        communityDeck.title as string,
      published_at: communityDeck.created_at as string,
      terms: cards.map((c) => ({
        front: c.front,
        back:  c.back,
        zone:  (c.zone === 'red' ? 'red' : 'likely') as 'red' | 'likely',
      })),
    }
    return NextResponse.json({ deck })
  }

  // ── Fallback: shared_decks (legacy) ──────────────────────────────────────────
  const { data: legacyDeck } = await supabase
    .from('shared_decks')
    .select('deck_id, title, terms, published_at')
    .eq('room_id', roomId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (legacyDeck) {
    const rawTerms = (legacyDeck.terms ?? []) as { front?: string; back?: string }[]
    const deck: DeckResponse = {
      deck_id:      legacyDeck.deck_id as string,
      title:        legacyDeck.title   as string,
      published_at: legacyDeck.published_at as string,
      terms: rawTerms.map((t) => ({
        front: t.front ?? '',
        back:  t.back  ?? '',
        zone:  'likely' as const,   // legacy decks have no zone data
      })),
    }
    return NextResponse.json({ deck })
  }

  return NextResponse.json({ deck: null })
}

// Legacy POST — still used if someone calls the old endpoint directly.
export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = makeClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId, title, terms } = await request.json() as {
    roomId: string
    title: string
    terms: Array<{ front: string; back?: string }>
  }

  if (!roomId || !title || !Array.isArray(terms))
    return NextResponse.json({ error: 'roomId, title, and terms required' }, { status: 400 })

  const { data: deckId, error } = await supabase.rpc('publish_shared_deck', {
    p_room_id: roomId,
    p_title:   title,
    p_terms:   JSON.stringify(terms),
  })

  if (error || !deckId) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
  return NextResponse.json({ deckId })
}
