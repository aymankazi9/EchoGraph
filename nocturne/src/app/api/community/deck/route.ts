// GET  /api/community/deck?roomId=…  — fetch the latest shared deck for a room.
// POST /api/community/deck           — publish a new shared deck.

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

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = makeClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const roomId = request.nextUrl.searchParams.get('roomId')
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const { data: deck } = await supabase
    .from('shared_decks')
    .select('deck_id, title, terms, published_at')
    .eq('room_id', roomId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ deck: deck ?? null })
}

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
