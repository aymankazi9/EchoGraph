import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { SessionClient } from './SessionClient'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: sessionId } = await params
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title_encrypted, has_slides, has_audio, has_study_guide, guide_type, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) notFound()

  // Fetch PDF and audio file rows in parallel.
  const [{ data: pdfFile }, { data: audioFile }] = await Promise.all([
    supabase
      .from('files')
      .select('id, storage_path, iv')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('file_type', 'pdf')
      .maybeSingle(),
    supabase
      .from('files')
      .select('id, storage_path')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('file_type', 'audio')
      .maybeSingle(),
  ])

  return (
    <SessionClient
      userId={user.id}
      session={session}
      pdfFile={pdfFile ?? null}
      audioFile={audioFile ?? null}
    />
  )
}
