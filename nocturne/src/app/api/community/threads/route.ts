// POST /api/community/threads — create a thread or reply.
//
// Create thread:  body = { roomId: string, title: string }
// Create reply:   body = { threadId: string, content: string }

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

  const body = await request.json() as { roomId?: string; title?: string; threadId?: string; content?: string }

  if (body.roomId && body.title) {
    const { data: threadId, error } = await supabase.rpc('create_community_thread', {
      p_room_id: body.roomId,
      p_title: body.title,
    })
    if (error || !threadId) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
    return NextResponse.json({ threadId })
  }

  if (body.threadId && body.content) {
    const { data: replyId, error } = await supabase.rpc('create_community_reply', {
      p_thread_id: body.threadId,
      p_content: body.content,
    })
    if (error || !replyId) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })
    return NextResponse.json({ replyId })
  }

  return NextResponse.json({ error: 'Provide (roomId + title) or (threadId + content)' }, { status: 400 })
}
