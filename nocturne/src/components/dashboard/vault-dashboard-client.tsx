'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { Plus, RefreshCw } from 'lucide-react'
import { getMasterKey, isVaultUnlocked } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { encryptText } from '@/lib/crypto/encrypt'
import { createClient } from '@/lib/supabase'
import { useDashboardStore, type SessionRow } from '@/store/dashboard-store'
import { SessionCard } from './session-card'
import { SessionCardSkeleton } from './session-card-skeleton'
import { EmptyState } from './empty-state'
import { VaultSearch } from './vault-search'
import { FilterChips } from './filter-chips'
import { SortControl } from './sort-control'
import { EmptyFilteredState } from './empty-filtered-state'
import { GettingStarted } from './getting-started'
import { MomentumRibbon } from './momentum-ribbon'

interface RawSession {
  id: string
  title_encrypted: string | null
  has_slides: boolean
  has_audio: boolean
  has_study_guide: boolean
  guide_type: string | null
  status: string
  created_at: string
}

interface Props {
  userId: string
  sessions: RawSession[]
  redZoneCounts: Record<string, number>
  slideCounts: Record<string, number>
  fileSizeBytes: Record<string, number>
  storageMB: number
  sessionCount: number
  checklistDismissed: boolean
  checklistCompleted: boolean
  checklistExported: boolean
}

export function VaultDashboardClient({
  userId,
  sessions,
  redZoneCounts,
  slideCounts,
  fileSizeBytes,
  storageMB,
  sessionCount,
  checklistDismissed,
  checklistCompleted,
  checklistExported,
}: Props) {
  const router = useRouter()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Stable supabase client — used for realtime + manual refresh
  const supabase = useMemo(() => createClient(), [])

  const setSessions = useDashboardStore((s) => s.setSessions)
  const setTitleMap = useDashboardStore((s) => s.setTitleMap)
  const filteredSessions = useDashboardStore((s) => s.filteredSessions)
  const isLoading = useDashboardStore((s) => s.isLoading)
  const searchQuery = useDashboardStore((s) => s.searchQuery)
  const statusFilter = useDashboardStore((s) => s.statusFilter)
  const inputFilters = useDashboardStore((s) => s.inputFilters)
  const clearFilters = useDashboardStore((s) => s.clearFilters)

  const isFiltered =
    searchQuery.trim() !== '' || statusFilter !== 'all' || inputFilters.length > 0

  // ── Load sessions into store on mount ──────────────────────────────────────
  useEffect(() => {
    if (!isVaultUnlocked()) {
      router.replace('/unlock')
      return
    }

    const rows: SessionRow[] = sessions.map((s) => ({
      ...s,
      red_zone_count: redZoneCounts[s.id] ?? 0,
      storage_used_bytes: fileSizeBytes[s.id] ?? 0,
    }))
    setSessions(rows)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Decrypt all titles once — store in titleMap for search + sort ──────────
  const decryptTitles = useCallback(async () => {
    const mk = getMasterKey()
    if (!mk) return

    const entries = await Promise.all(
      sessions.map(async (s): Promise<[string, string]> => {
        if (!s.title_encrypted) return [s.id, '']
        try {
          const title = await decryptText(mk, s.title_encrypted)
          return [s.id, title]
        } catch {
          return [s.id, '']
        }
      }),
    )

    setTitleMap(new Map(entries))
  }, [sessions, setTitleMap])

  useEffect(() => {
    decryptTitles()
  }, [decryptTitles])

  // ── Reset store on unmount ─────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      // Reset to defaults so filters don't persist across page navigations.
      clearFilters()
    }
  }, [clearFilters])

  // ── Realtime: update session status/guide in store when DB row changes ─────
  // NOTE: requires REPLICA IDENTITY FULL on sessions table in Supabase.
  // Enable in Supabase SQL Editor: ALTER TABLE public.sessions REPLICA IDENTITY FULL;
  // Enable replication: Database → Replication → sessions table → toggle on.
  useEffect(() => {
    const channel = supabase
      .channel('sessions-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          useDashboardStore.getState().updateSession(payload.new.id as string, {
            status: payload.new.status as string,
            has_study_guide: payload.new.has_study_guide as boolean,
            guide_type: payload.new.guide_type as string | null,
            has_slides: payload.new.has_slides as boolean,
            has_audio: payload.new.has_audio as boolean,
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  // ── Manual refresh: re-fetch sessions from Supabase ────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const { data } = await supabase
        .from('sessions')
        .select('id, title_encrypted, has_slides, has_audio, has_study_guide, guide_type, status, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (data) {
        const existing = useDashboardStore.getState().sessions
        const existingMap = Object.fromEntries(existing.map((s) => [s.id, s]))
        const rows: SessionRow[] = data.map((s) => ({
          ...s,
          red_zone_count: existingMap[s.id]?.red_zone_count ?? 0,
          storage_used_bytes: existingMap[s.id]?.storage_used_bytes ?? 0,
        }))
        useDashboardStore.getState().setSessions(rows)
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [supabase])

  // ── Cmd/Ctrl+K global shortcut ─────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Delete handler — remove from store ────────────────────────────────────
  function handleDelete(id: string) {
    const currentSessions = useDashboardStore.getState().sessions
    useDashboardStore.getState().setSessions(currentSessions.filter((s) => s.id !== id))
  }

  // ── Rename handler — encrypt + PATCH + update titleMap ────────────────────
  async function handleRename(id: string, newTitle: string) {
    const mk = getMasterKey()
    if (!mk) throw new Error('Vault locked')
    const titleEncrypted = await encryptText(mk, newTitle)
    const supabase = createClient()
    const { error } = await supabase
      .from('sessions')
      .update({ title_encrypted: titleEncrypted })
      .eq('id', id)
    if (error) throw error
    useDashboardStore.getState().updateTitle(id, newTitle)
  }

  // ── Derive per-card title from store's titleMap ───────────────────────────
  const titleMap = useDashboardStore((s) => s.titleMap)

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col">
        <GettingStarted
          userId={userId}
          sessions={sessions}
          redZoneCounts={redZoneCounts}
          initialChecklistDismissed={checklistDismissed}
          initialChecklistCompleted={checklistCompleted}
          initialChecklistExported={checklistExported}
        />
        <EmptyState />
      </div>
    )
  }

  const showResultCount = isFiltered

  return (
    <div>
      {/* Getting started checklist */}
      <GettingStarted
        userId={userId}
        sessions={sessions}
        redZoneCounts={redZoneCounts}
        initialChecklistDismissed={checklistDismissed}
        initialChecklistCompleted={checklistCompleted}
        initialChecklistExported={checklistExported}
      />

      {/* Page header */}
      <div className="flex items-center justify-between mb-2">
        <h1 style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', color: '#E2E8F0', margin: 0 }}>Your vault</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh sessions"
            aria-label="Refresh sessions"
            className="w-9 h-9 flex items-center justify-center rounded-btn text-text-tertiary hover:text-text-secondary hover:bg-bg-subtle transition-colors disabled:opacity-40"
          >
            <RefreshCw size={16} strokeWidth={1.5} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/session/new"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} />
            New session
          </Link>
        </div>
      </div>
      <p className="text-body-sm text-text-secondary mb-3">
        {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'} · {storageMB.toFixed(1)} MB used
      </p>

      {/* Ambient momentum ribbon */}
      <MomentumRibbon />

      {/* Search bar */}
      <div className="mb-3">
        <VaultSearch inputRef={searchInputRef} />
      </div>

      {/* Filter chips + sort */}
      <div className="mb-3">
        <FilterChips sortSlot={<SortControl />} />
      </div>

      {/* Result count — only shown when filtered */}
      {showResultCount && (
        <p className="text-caption text-text-tertiary mb-3">
          {filteredSessions.length} of {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
        </p>
      )}

      {/* Card grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {sessions.slice(0, 4).map((s) => <SessionCardSkeleton key={s.id} />)}
        </div>
      ) : filteredSessions.length === 0 && isFiltered ? (
        <EmptyFilteredState />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <AnimatePresence>
            {filteredSessions.map((s) => (
              <SessionCard
                key={s.id}
                id={s.id}
                title={titleMap[s.id] ?? null}
                status={s.status}
                hasSlides={s.has_slides}
                hasAudio={s.has_audio}
                hasStudyGuide={s.has_study_guide}
                guideType={s.guide_type}
                createdAt={s.created_at}
                redZoneCount={s.red_zone_count}
                slideCount={slideCounts[s.id] ?? 0}
                sizeMB={0}
                onDelete={handleDelete}
                onRename={handleRename}
                highlightQuery={searchQuery}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
