import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(req: Request) {
  const supabase = await createServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { session_id?: string; card_count: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { session_id, card_count } = body
  if (typeof card_count !== 'number' || card_count < 0) {
    return NextResponse.json({ error: 'card_count must be a non-negative number' }, { status: 400 })
  }

  const { error } = await supabase.from('export_events').insert({
    user_id: user.id,
    session_id: session_id ?? null,
    card_count,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
