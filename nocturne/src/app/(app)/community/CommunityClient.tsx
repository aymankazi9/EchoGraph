'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { getMasterKey } from '@/lib/crypto/vault'
import { encryptText } from '@/lib/crypto/encrypt'
import { hashMemberId, hashPoolTerm } from '@/lib/crypto/community-hash'

// ── Types ─────────────────────────────────────────────────────────────────────

type Room = {
  room_id: string
  course_code: string
  display_name: string
  member_count: number
  institution_id: string
}

type Thread = {
  thread_id: string
  title: string
  reply_count: number
  created_at: string
}

type DeckTerm = { front: string; back?: string }

type SharedDeck = {
  deck_id: string
  title: string
  terms: DeckTerm[]
  published_at: string
} | null

type DisplayKeyword = {
  rank: string
  term: string
  count: number
  pct: number
  inPool: boolean
}

// ── SVG Icons ──────────────────────────────────────────────────────────────────

const UsersIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 14v-1a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v1" />
    <circle cx="7.5" cy="6.5" r="2.5" />
    <path d="M15 14v-1a3 3 0 0 0-2-2.83" />
    <path d="M12.5 4a2.5 2.5 0 0 1 0 5" />
  </svg>
)

const SchoolIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2 L17 7 L9 12 L1 7 Z" />
    <path d="M5 9.5 V14.5 C5 14.5 7 16 9 16 C11 16 13 14.5 13 14.5 V9.5" />
    <path d="M17 7 V12" />
  </svg>
)

const ShieldIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 1.5 L15 4 V9 C15 12.5 12.2 15.5 9 16.5 C5.8 15.5 3 12.5 3 9 V4 Z" />
  </svg>
)

const LockIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="8" width="11" height="8.5" rx="1.5" />
    <path d="M6 8 V5.5 a3 3 0 0 1 6 0 V8" />
  </svg>
)

const SearchIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="7.5" r="5" />
    <path d="M11.5 11.5 L16 16" />
  </svg>
)

const CheckIcon = ({ size = 11, stroke = '#09090F' }: { size?: number; stroke?: string }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9.5 L7.5 13 L14 5" />
  </svg>
)

const BookOpenIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3.5 C2 3.5 5 3 9 4 C13 3 16 3.5 16 3.5 V14.5 C16 14.5 13 14 9 15 C5 14 2 14.5 2 14.5 Z" />
    <path d="M9 4 V15" />
  </svg>
)

const PlusIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M9 3 V15 M3 9 H15" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function roomMonogram(code: string) {
  const parts = code.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase()
  return parts[0].slice(0, 2).toUpperCase()
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommunityClient({ userId }: { userId: string }) {
  const [supabase] = useState(() => createClient())

  const [allRooms, setAllRooms] = useState<Room[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [threads, setThreads] = useState<Thread[]>([])
  const [deck, setDeck] = useState<SharedDeck>(null)
  const [displayKeywords, setDisplayKeywords] = useState<DisplayKeyword[]>([])
  const [poolCount, setPoolCount] = useState(0)
  const [activeCount, setActiveCount] = useState(0)
  const [sharedDeckCount, setSharedDeckCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)
  const [isAddingToVault, setIsAddingToVault] = useState(false)
  const [vaultSuccess, setVaultSuccess] = useState(false)
  const [newThreadTitle, setNewThreadTitle] = useState('')
  const [showNewThread, setShowNewThread] = useState(false)
  const [threadPosting, setThreadPosting] = useState(false)

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load all rooms + derive membership on mount
  useEffect(() => {
    async function load() {
      const { data: rooms } = await supabase
        .from('community_rooms')
        .select('room_id, course_code, display_name, member_count, institution_id')
        .order('member_count', { ascending: false })

      if (!rooms?.length) { setLoading(false); return }
      setAllRooms(rooms)

      // Compute this user's hash for each room, then batch-check memberships
      const hashes = await Promise.all(rooms.map(r => hashMemberId(userId, r.room_id)))
      const { data: memberships } = await supabase
        .from('room_memberships')
        .select('room_id')
        .in('user_id_hash', hashes)

      if (memberships?.length) {
        const joined = new Set(memberships.map(m => m.room_id as string))
        setJoinedIds(joined)
        setActiveRoomId([...joined][0] ?? null)
      }
      setLoading(false)
    }
    load()
  }, [userId, supabase])

  // Load room content when active room changes
  useEffect(() => {
    if (!activeRoomId) return

    // Threads
    supabase
      .from('community_threads')
      .select('thread_id, title, reply_count, created_at')
      .eq('room_id', activeRoomId)
      .order('created_at', { ascending: false })
      .limit(15)
      .then(({ data }) => setThreads(data ?? []))

    // Shared deck
    fetch(`/api/community/deck?roomId=${activeRoomId}`)
      .then(r => r.json())
      .then(({ deck: d }) => setDeck(d))

    // Pool entry count
    supabase
      .from('community_keyword_pool')
      .select('term_hash', { count: 'exact', head: true })
      .eq('room_id', activeRoomId)
      .then(({ count }) => setPoolCount(count ?? 0))

    // Active count (presence within last 3 min)
    supabase
      .rpc('get_active_count', { p_room_id: activeRoomId })
      .then(({ data }) => setActiveCount((data as number) ?? 0))

    // Shared deck count for room stats
    supabase
      .from('shared_decks')
      .select('deck_id', { count: 'exact', head: true })
      .eq('room_id', activeRoomId)
      .then(({ count }) => setSharedDeckCount(count ?? 0))
  }, [activeRoomId, supabase])

  // Build keyword display list from deck terms + pool hash lookup
  useEffect(() => {
    if (!deck || !activeRoomId) { setDisplayKeywords([]); return }

    async function buildKeywords() {
      if (!deck) return
      const terms = deck.terms.slice(0, 6)

      // Hash each term to look up in pool
      const hashes = await Promise.all(terms.map(t => hashPoolTerm(activeRoomId!, t.front)))

      const { data: poolRows } = await supabase
        .from('community_keyword_pool')
        .select('term_hash, count')
        .eq('room_id', activeRoomId!)
        .in('term_hash', hashes)

      const poolMap = new Map((poolRows ?? []).map(r => [r.term_hash as string, r.count as number]))
      const maxCount = Math.max(1, ...Array.from(poolMap.values()))

      const kws: DisplayKeyword[] = terms.map((t, i) => {
        const hash = hashes[i]!
        const count = poolMap.get(hash) ?? 0
        return {
          rank: String(i + 1).padStart(2, '0'),
          term: t.front,
          count,
          pct: count / maxCount,
          inPool: count > 0,
        }
      })
      setDisplayKeywords(kws)
    }

    buildKeywords()
  }, [deck, activeRoomId, supabase])

  // Presence heartbeat for active joined room
  useEffect(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    if (!activeRoomId || !joinedIds.has(activeRoomId)) return

    void supabase.rpc('heartbeat_presence', { p_room_id: activeRoomId })
    heartbeatRef.current = setInterval(() => {
      void supabase.rpc('heartbeat_presence', { p_room_id: activeRoomId })
    }, 60_000)

    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current) }
  }, [activeRoomId, joinedIds, supabase])

  async function handleJoin(roomId: string) {
    setJoiningId(roomId)
    try {
      const res = await fetch('/api/community/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      })
      const data = await res.json() as { success?: boolean; member_count?: number; error?: string; code?: string }
      if (res.ok) {
        setJoinedIds(prev => new Set([...prev, roomId]))
        setAllRooms(prev => prev.map(r =>
          r.room_id === roomId ? { ...r, member_count: data.member_count ?? r.member_count + 1 } : r
        ))
        setActiveRoomId(roomId)
      } else {
        alert(data.error ?? 'Failed to join room')
      }
    } finally {
      setJoiningId(null)
    }
  }

  async function handleLeave() {
    if (!activeRoomId) return
    setIsLeaving(true)
    try {
      await fetch('/api/community/join', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoomId }),
      })
      const leftId = activeRoomId
      setJoinedIds(prev => { const s = new Set(prev); s.delete(leftId); return s })
      setAllRooms(prev => prev.map(r =>
        r.room_id === leftId ? { ...r, member_count: Math.max(0, r.member_count - 1) } : r
      ))
      setActiveRoomId(prev => {
        const remaining = allRooms
          .filter(r => joinedIds.has(r.room_id) && r.room_id !== leftId)
          .map(r => r.room_id)
        return remaining[0] ?? null
      })
    } finally {
      setIsLeaving(false)
    }
  }

  async function handleAddToVault() {
    if (!deck) return
    const mk = getMasterKey()
    if (!mk) {
      alert('Your vault is locked. Unlock it first to import cards.')
      return
    }
    setIsAddingToVault(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const sessionId = crypto.randomUUID()
      const titleEncrypted = await encryptText(mk, deck.title)

      const { error: sessionErr } = await supabase.from('sessions').insert({
        id: sessionId,
        user_id: user.id,
        title_encrypted: titleEncrypted,
        status: 'ready',
        has_slides: false,
        has_audio: false,
        has_study_guide: true,
      })
      if (sessionErr) { alert('Failed to create session'); return }

      if (deck.terms.length > 0) {
        const rows = await Promise.all(
          deck.terms.map(async t => ({
            id: crypto.randomUUID(),
            session_id: sessionId,
            user_id: user.id,
            front_encrypted: await encryptText(mk, t.front),
            back_encrypted: await encryptText(mk, t.back ?? ''),
            slide_index: null,
            zone: null,
          }))
        )
        await supabase.from('flashcards').insert(rows)
      }

      setVaultSuccess(true)
      setTimeout(() => setVaultSuccess(false), 3500)
    } finally {
      setIsAddingToVault(false)
    }
  }

  async function handleCreateThread() {
    const title = newThreadTitle.trim()
    if (!title || !activeRoomId) return
    setThreadPosting(true)
    try {
      const res = await fetch('/api/community/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: activeRoomId, title }),
      })
      if (res.ok) {
        const { threadId } = await res.json() as { threadId: string }
        setThreads(prev => [{ thread_id: threadId, title, reply_count: 0, created_at: new Date().toISOString() }, ...prev])
        setNewThreadTitle('')
        setShowNewThread(false)
      }
    } finally {
      setThreadPosting(false)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const joinedRooms = allRooms.filter(r => joinedIds.has(r.room_id))
  const discoverRooms = allRooms.filter(r => !joinedIds.has(r.room_id))
  const activeRoom = allRooms.find(r => r.room_id === activeRoomId) ?? null
  const institutionDisplay = activeRoom
    ? activeRoom.institution_id.replace(/\b\w/g, c => c.toUpperCase()).replace('.edu', ' (.edu)')
    : 'Your Institution'

  const filteredDiscover = discoverRooms.filter(d => {
    if (!query) return true
    const q = query.toLowerCase()
    return d.course_code.toLowerCase().includes(q) || d.display_name.toLowerCase().includes(q)
  })

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 40px' }}>
        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3F485C', fontSize: 13 }}>
          Loading community rooms…
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 300,
        background: 'radial-gradient(720px 300px at 26% -90px, rgba(99,102,241,0.1) 0%, rgba(139,92,246,0.04) 44%, transparent 74%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '34px 40px 90px', position: 'relative', zIndex: 1 }}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', color: '#E2E8F0', margin: 0 }}>
                Community
              </h1>
              <span style={{
                display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 9999,
                border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)',
                fontSize: 10.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#A5B4FC',
              }}>
                Beta
              </span>
            </div>
            <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>
              Join your course, not a network. Rooms are anonymous, course-scoped, and you can leave any time.
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0, height: 38, padding: '0 14px',
            borderRadius: 10, border: '1px solid #1E1E2E', background: '#0D0D14',
            color: '#CBD5E1', fontSize: 13,
          }}>
            <SchoolIcon size={15} />
            {activeRoom?.institution_id
              ? activeRoom.institution_id.toUpperCase()
              : 'Institution'}
          </div>
        </div>

        {/* ── Your course rooms ─────────────────────────────────────────── */}
        {joinedRooms.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#5B6478' }}>
                YOUR COURSE ROOMS
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#3F485C' }}>
                {joinedRooms.length} joined
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13 }}>
              {joinedRooms.map(r => (
                <button
                  key={r.room_id}
                  onClick={() => setActiveRoomId(r.room_id)}
                  style={{
                    display: 'flex', flexDirection: 'column', padding: '16px 18px', borderRadius: 14,
                    textAlign: 'left', width: '100%', cursor: 'pointer',
                    border: activeRoomId === r.room_id ? '1px solid rgba(99,102,241,0.45)' : '1px solid #1A1A26',
                    background: activeRoomId === r.room_id ? 'rgba(99,102,241,0.07)' : '#0B0B11',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
                      color: activeRoomId === r.room_id ? '#A5B4FC' : '#5B6478',
                      padding: '3px 7px', borderRadius: 6,
                      background: activeRoomId === r.room_id ? 'rgba(99,102,241,0.12)' : '#13121C',
                    }}>
                      {r.course_code}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', textAlign: 'left', marginTop: 11, lineHeight: 1.3 }}>
                    {r.display_name.split(' — ')[0] ?? r.display_name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9 }}>
                    <UsersIcon size={13} />
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>{r.member_count} in room</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Active room panel ─────────────────────────────────────────── */}
        {activeRoom && joinedIds.has(activeRoom.room_id) && (
          <div style={{ marginTop: 18, border: '1px solid #1A1A26', borderRadius: 18, background: '#0B0B11', overflow: 'hidden' }}>

            {/* Room header */}
            <div style={{
              padding: '20px 22px', borderBottom: '1px solid #16151F',
              background: 'linear-gradient(120deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.03) 45%, transparent 100%)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: '#A5B4FC',
                  }}>
                    {roomMonogram(activeRoom.course_code)}
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#E2E8F0', marginBottom: 3 }}>
                      {activeRoom.display_name.split(' — ')[0] ?? activeRoom.display_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#5B6478', fontFamily: 'monospace' }}>
                      {activeRoom.course_code} · {activeRoom.institution_id.toUpperCase()} · {activeRoom.member_count} classmates this term
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 9999,
                    border: '1px solid rgba(45,212,191,0.25)', background: 'rgba(45,212,191,0.07)',
                    fontSize: 12, color: '#5EEAD4',
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', background: '#2DD4BF',
                      boxShadow: '0 0 6px rgba(45,212,191,0.6)', display: 'inline-block',
                    }} />
                    {activeCount} active now
                  </span>
                  <button
                    onClick={handleLeave}
                    disabled={isLeaving}
                    style={{
                      height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #1E1E2E',
                      background: 'transparent', color: '#5B6478', fontSize: 12, cursor: 'pointer',
                      opacity: isLeaving ? 0.5 : 1,
                    }}
                  >
                    {isLeaving ? 'Leaving…' : 'Leave'}
                  </button>
                </div>
              </div>
            </div>

            {/* Room body — 2 col */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 0 }}>

              {/* Left column */}
              <div style={{ padding: 22, borderRight: '1px solid #16151F' }}>

                {/* Keywords section */}
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>What the class is flagging</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#3F485C', letterSpacing: '0.04em' }}>
                    {poolCount > 0 ? `${poolCount} topics tracked` : 'no topics yet'}
                  </span>
                </div>

                <p style={{ fontSize: 11.5, color: '#5B6478', margin: '0 0 14px', lineHeight: 1.55 }}>
                  Most-flagged topics from this room&apos;s shared deck. Your transcripts never leave your device — only counts are pooled.
                </p>

                {displayKeywords.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {displayKeywords.map(kw => (
                      <div
                        key={kw.rank}
                        style={{
                          display: 'grid', gridTemplateColumns: '22px 1fr 52px 22px',
                          alignItems: 'center', gap: 10, padding: '8px 8px', borderRadius: 8,
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#3F485C', fontWeight: 600 }}>{kw.rank}</span>
                        <div>
                          <div style={{ fontSize: 12.5, color: '#CBD5E1', marginBottom: 5 }}>{kw.term}</div>
                          <div style={{ height: 5, borderRadius: 3, background: '#16151F', overflow: 'hidden' }}>
                            <div style={{
                              width: `${Math.max(kw.pct * 100, kw.inPool ? 4 : 0)}%`,
                              height: '100%', borderRadius: 3,
                              background: kw.inPool ? '#FB7185' : '#818CF8', opacity: 0.85,
                            }} />
                          </div>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#3F485C', textAlign: 'right' }}>
                          {kw.count > 0 ? kw.count : '—'}
                        </span>
                        {kw.inPool ? (
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%', background: '#6366F1',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <CheckIcon size={9} stroke="#09090F" />
                          </div>
                        ) : (
                          <div style={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px dashed #2D2B45', flexShrink: 0 }} />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    padding: '20px 0', textAlign: 'center', color: '#3F485C', fontSize: 12.5, lineHeight: 1.6,
                  }}>
                    No shared deck yet.<br />
                    <span style={{ color: '#2D2B45' }}>Publish one to let classmates see the class&apos;s top topics.</span>
                  </div>
                )}

                <div style={{ height: 1, background: '#16151F', margin: '16px 0' }} />

                {/* Study threads */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>Study threads</span>
                  <button
                    onClick={() => setShowNewThread(v => !v)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 7,
                      border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.07)',
                      color: '#A5B4FC', fontSize: 11.5, cursor: 'pointer',
                    }}
                  >
                    <PlusIcon size={10} /> New thread
                  </button>
                </div>

                {showNewThread && (
                  <div style={{ display: 'flex', gap: 7, marginBottom: 10 }}>
                    <input
                      type="text"
                      placeholder="Thread title…"
                      value={newThreadTitle}
                      onChange={e => setNewThreadTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateThread()}
                      autoFocus
                      style={{
                        flex: 1, height: 34, padding: '0 12px', borderRadius: 8,
                        border: '1px solid #1E1E2E', background: '#0D0D14',
                        color: '#CBD5E1', fontSize: 12.5, outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleCreateThread}
                      disabled={!newThreadTitle.trim() || threadPosting}
                      style={{
                        height: 34, padding: '0 14px', borderRadius: 8,
                        border: 'none', background: '#6366F1', color: '#E2E8F0',
                        fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        opacity: (!newThreadTitle.trim() || threadPosting) ? 0.5 : 1,
                      }}
                    >
                      {threadPosting ? '…' : 'Post'}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {threads.length === 0 ? (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: '#3F485C', fontSize: 12.5 }}>
                      No threads yet — start the conversation.
                    </div>
                  ) : threads.map(t => (
                    <div
                      key={t.thread_id}
                      style={{
                        padding: '10px 12px', borderRadius: 10,
                        border: '1px solid #16151F', background: 'transparent', cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: 12.5, color: '#CBD5E1', marginBottom: 4, lineHeight: 1.4 }}>{t.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#5B6478' }}>{t.reply_count} replies</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#3F485C' }}>{timeAgo(t.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column */}
              <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Shared deck card */}
                <div style={{
                  borderRadius: 14, border: '1px solid rgba(244,63,94,0.22)',
                  background: 'linear-gradient(135deg, rgba(244,63,94,0.06) 0%, rgba(139,92,246,0.03) 60%, transparent 100%)',
                  padding: '16px 16px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldIcon size={16} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#FB7185' }}>Shared deck</span>
                    </div>
                    {deck && (
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, color: '#FB7185', padding: '2px 7px', borderRadius: 6,
                        background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.2)',
                        fontFamily: 'monospace', letterSpacing: '0.03em',
                      }}>
                        {deck.terms.length} cards
                      </span>
                    )}
                  </div>
                  {deck ? (
                    <>
                      <div style={{ fontSize: 12.5, color: '#94A3B8', marginBottom: 14, lineHeight: 1.5 }}>
                        <strong style={{ color: '#CBD5E1' }}>{deck.title}</strong>
                        {' '}— published {timeAgo(deck.published_at)}. Built from the class&apos;s highest-flagged topics.
                      </div>
                      <button
                        onClick={handleAddToVault}
                        disabled={isAddingToVault || vaultSuccess}
                        style={{
                          width: '100%', height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: vaultSuccess ? '#10B981' : '#6366F1',
                          color: '#E2E8F0', fontSize: 12.5, fontWeight: 600,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                          opacity: isAddingToVault ? 0.6 : 1, transition: 'background 0.2s',
                        }}
                      >
                        <BookOpenIcon size={14} />
                        {isAddingToVault ? 'Importing…' : vaultSuccess ? 'Added to vault ✓' : 'Add deck to my vault'}
                      </button>
                    </>
                  ) : (
                    <div style={{ fontSize: 12.5, color: '#3F485C', lineHeight: 1.5 }}>
                      No deck published yet. Room members can publish a shared deck to help everyone study.
                    </div>
                  )}
                </div>

                {/* Room stats */}
                <div style={{ borderRadius: 14, border: '1px solid #1A1A26', background: '#0C0C13', padding: '14px 16px' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: '#CBD5E1', marginBottom: 12 }}>This room</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      { label: 'Members', value: String(activeRoom.member_count) },
                      { label: 'Topics tracked', value: String(poolCount) },
                      { label: 'Shared decks', value: String(sharedDeckCount) },
                    ].map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#5B6478' }}>{a.label}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#CBD5E1' }}>{a.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Privacy note */}
                <div style={{
                  borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)',
                  background: 'rgba(99,102,241,0.06)', padding: '12px 14px',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ color: '#818CF8', flexShrink: 0, paddingTop: 1 }}>
                    <LockIcon size={14} />
                  </div>
                  <p style={{ fontSize: 11.5, color: '#818CF8', margin: 0, lineHeight: 1.55 }}>
                    You&apos;re anonymous here. No name, no profile — just pooled keyword counts from your vault.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty joined state */}
        {joinedRooms.length === 0 && (
          <div style={{
            marginTop: 18, border: '1px solid #1A1A26', borderRadius: 18, background: '#0B0B11',
            padding: '48px 22px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, color: '#5B6478', marginBottom: 6 }}>No rooms joined yet</div>
            <div style={{ fontSize: 12.5, color: '#3F485C' }}>Search below and join a course room to get started.</div>
          </div>
        )}

        {/* ── Discover more rooms ───────────────────────────────────────── */}
        <div style={{
          marginTop: 18, border: '1px solid #1A1A26', borderRadius: 16,
          background: '#0C0C13', padding: '20px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#CBD5E1', marginBottom: 3 }}>Find more course rooms</div>
              <div style={{ fontSize: 12, color: '#5B6478' }}>
                {allRooms[0]?.institution_id
                  ? `Open rooms at ${allRooms[0].institution_id.toUpperCase()} — join to pool your keywords with classmates.`
                  : 'Join a room to pool your keywords with classmates.'}
              </div>
            </div>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#3F485C', pointerEvents: 'none' }}>
                <SearchIcon size={13} />
              </div>
              <input
                type="text"
                placeholder="Search courses…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{
                  width: 280, height: 34, paddingLeft: 30, paddingRight: 12, borderRadius: 9,
                  border: '1px solid #1E1E2E', background: '#0D0D14', color: '#CBD5E1',
                  fontSize: 13, outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredDiscover.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center', color: '#3F485C', fontSize: 13 }}>
                {query ? `No rooms matching "${query}".` : 'You&apos;ve joined all available rooms.'}
              </div>
            ) : filteredDiscover.map(d => (
              <div
                key={d.room_id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '11px 14px',
                  borderRadius: 11, border: '1px solid #16151F', background: '#0B0B11',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 9, flexShrink: 0,
                  background: '#13121C', border: '1px solid #1A1A26',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'monospace', fontSize: 10.5, fontWeight: 700,
                  letterSpacing: '0.04em', color: '#5B6478', textAlign: 'center' as const,
                }}>
                  {roomMonogram(d.course_code)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#CBD5E1', marginBottom: 3 }}>
                    {d.display_name.split(' — ')[0] ?? d.display_name}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#3F485C' }}>{d.course_code}</span>
                    <span style={{ fontSize: 11, color: '#3F485C' }}>{d.member_count} members</span>
                  </div>
                </div>

                <button
                  onClick={() => handleJoin(d.room_id)}
                  disabled={joiningId === d.room_id}
                  style={{
                    height: 32, padding: '0 14px', borderRadius: 8, flexShrink: 0,
                    border: '1px solid rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.1)',
                    color: '#A5B4FC', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                    opacity: joiningId === d.room_id ? 0.5 : 1,
                  }}
                >
                  {joiningId === d.room_id ? 'Joining…' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
