'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { getMasterKey, isVaultUnlocked } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { useDashboardStore, type SessionRow } from '@/store/dashboard-store'
import { SessionCard } from './session-card'
import { SessionCardSkeleton } from './session-card-skeleton'
import { EmptyState } from './empty-state'
import { VaultSearch } from './vault-search'
import { FilterChips } from './filter-chips'
import { SortControl } from './sort-control'
import { EmptyFilteredState } from './empty-filtered-state'
import { GettingStarted } from './getting-started'

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

  // ── Derive per-card title from store's titleMap ───────────────────────────
  const titleMap = useDashboardStore((s) => s.titleMap)

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="px-6 pt-8">
          <GettingStarted
            userId={userId}
            sessions={sessions}
            redZoneCounts={redZoneCounts}
            initialChecklistDismissed={checklistDismissed}
            initialChecklistCompleted={checklistCompleted}
            initialChecklistExported={checklistExported}
          />
        </div>
        <EmptyState />
      </div>
    )
  }

  const showResultCount = isFiltered

  return (
    <div className="px-6 py-8">
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
        <h1 className="text-heading font-medium text-text-primary">Your vault</h1>
        <Link
          href="/session/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors"
        >
          <Plus size={14} strokeWidth={1.5} />
          New session
        </Link>
      </div>
      <p className="text-body-sm text-text-secondary mb-5">
        {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'} · {storageMB.toFixed(1)} MB used
      </p>

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
                title={titleMap.get(s.id) ?? null}
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
                highlightQuery={searchQuery}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
