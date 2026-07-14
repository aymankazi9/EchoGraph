import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function makeClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  })
}

// POST /api/community/join  — join a room (domain-gated)
// DELETE /api/community/join — leave a room

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = makeClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId } = await request.json() as { roomId: string }
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  const { data, error } = await supabase.rpc('join_room', { p_room_id: roomId })

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('domain_not_allowed'))
      return NextResponse.json({ error: 'Your email domain is not authorized for this room.', code: 'domain_not_allowed' }, { status: 403 })
    if (msg.includes('room_not_found'))
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = makeClient(cookieStore)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { roomId } = await request.json() as { roomId: string }
  if (!roomId) return NextResponse.json({ error: 'roomId required' }, { status: 400 })

  await supabase.rpc('leave_room', { p_room_id: roomId })
  return NextResponse.json({ success: true })
}
