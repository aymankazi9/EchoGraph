import { redirect, notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase-server'
import { getUserTier } from '@/lib/tiers/server'
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

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, title_encrypted, has_slides, has_audio, has_study_guide, guide_type, status, course_tag')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  // PGRST116 = no rows returned — genuine "not found"
  // Other errors (e.g. missing column) should surface as 500, not a misleading 404
  if (!session) {
    if (sessionError && sessionError.code !== 'PGRST116') {
      throw new Error(`Failed to load session: ${sessionError.message}`)
    }
    notFound()
  }

  // Fetch all session files (via junction table), user profile, and tier in parallel.
  // session_files covers both legacy sessions (backfilled in migration 021) and new
  // uploads (which have files.session_id = NULL). Also touch last_opened_at.
  const [{ data: sfRows }, { data: userProfile }, userTier] = await Promise.all([
    supabase
      .from('session_files')
      .select('role, order_index, file_id')
      .eq('session_id', sessionId)
      .order('order_index'),
    supabase
      .from('users')
      .select('field, domain_prompt_dismissed')
      .eq('id', user.id)
      .single(),
    getUserTier(supabase, user.id),
    // Fire-and-forget alongside the data fetches; result is intentionally discarded.
    supabase.from('sessions').update({ last_opened_at: new Date().toISOString() }).eq('id', sessionId).eq('user_id', user.id),
  ])

  // Resolve file metadata for all referenced file IDs
  type FileRow = { id: string; storage_path: string }
  const fileIds = [...new Set((sfRows ?? []).map((r) => r.file_id as string))]
  const { data: fileRows } = fileIds.length > 0
    ? await supabase.from('files').select('id, storage_path').in('id', fileIds)
    : { data: [] as FileRow[] }
  const fileMap = new Map((fileRows ?? []).map((f) => [f.id as string, f as FileRow]))

  // Split by role — slides ordered by order_index (already sorted above)
  const slideFiles: FileRow[] = (sfRows ?? [])
    .filter((r) => r.role === 'slide')
    .map((r) => fileMap.get(r.file_id as string))
    .filter((f): f is FileRow => f != null)

  const pdfFile = slideFiles[0] ?? null

  // All audio takes in insertion order — multi-take recording may produce several.
  const audioFiles: FileRow[] = (sfRows ?? [])
    .filter((r) => r.role === 'audio')
    .map((r) => fileMap.get(r.file_id as string))
    .filter((f): f is FileRow => f != null)

  return (
    <SessionClient
      userId={user.id}
      session={session}
      pdfFile={pdfFile}
      slideFiles={slideFiles}
      audioFiles={audioFiles}
      initialUserField={userProfile?.field ?? null}
      domainPromptDismissed={userProfile?.domain_prompt_dismissed ?? false}
      userTier={userTier}
    />
  )
}
