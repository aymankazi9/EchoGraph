// POST /api/community/keywords
//
// Accepts a batch of pre-hashed term hashes from the client and increments
// their counts in community_keyword_pool. The server never receives plaintext.
//
// body: { roomId: string, termHashes: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
  })

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId, termHashes } = await request.json() as { roomId: string; termHashes: string[] }
  if (!roomId || !Array.isArray(termHashes) || termHashes.length === 0)
    return NextResponse.json({ error: 'roomId and termHashes required' }, { status: 400 })

  // Each call to increment_keyword_count is a SECURITY DEFINER function that
  // verifies membership internally — no plaintext ever reaches the server.
  const hashes = termHashes.slice(0, 200)
  const results = await Promise.allSettled(
    hashes.map((h) =>
      supabase.rpc('increment_keyword_count', { p_room_id: roomId, p_term_hash: h }),
    ),
  )

  const failed = results.filter((r) => r.status === 'rejected').length
  return NextResponse.json({ contributed: hashes.length - failed, failed })
}
