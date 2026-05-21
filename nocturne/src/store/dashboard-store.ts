import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionRow {
  id: string
  title_encrypted: string | null
  has_slides: boolean
  has_audio: boolean
  has_study_guide: boolean
  guide_type: string | null
  status: string
  created_at: string
  red_zone_count: number
  storage_used_bytes: number
}

export type StatusFilter =
  | 'all'
  | 'ready'
  | 'processing'
  | 'transcribing'
  | 'synced'

export type InputFilter = 'has_slides' | 'has_audio' | 'has_guide'

export type SortOrder =
  | 'newest'
  | 'oldest'
  | 'most_red_zone'
  | 'alphabetical'
  | 'largest'

// ─── Filtering helpers ────────────────────────────────────────────────────────

function matchesStatus(row: SessionRow, filter: StatusFilter, hasKeywords: boolean): boolean {
  if (filter === 'all') return true
  if (filter === 'ready') return row.status === 'synced' && hasKeywords
  if (filter === 'processing') return ['ingesting', 'processing'].includes(row.status)
  if (filter === 'transcribing') return ['transcribing', 'syncing'].includes(row.status)
  if (filter === 'synced') return row.status === 'synced'
  return true
}

function matchesInputFilters(row: SessionRow, filters: InputFilter[]): boolean {
  if (filters.length === 0) return true
  return filters.every((f) => {
    if (f === 'has_slides') return row.has_slides
    if (f === 'has_audio') return row.has_audio
    if (f === 'has_guide') return row.has_study_guide
    return true
  })
}

function applySort(
  rows: SessionRow[],
  order: SortOrder,
  titleMap: Map<string, string>,
): SessionRow[] {
  const sorted = [...rows]
  switch (order) {
    case 'newest':
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    case 'oldest':
      return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
    case 'most_red_zone':
      return sorted.sort((a, b) => b.red_zone_count - a.red_zone_count)
    case 'alphabetical': {
      return sorted.sort((a, b) => {
        const ta = titleMap.get(a.id) ?? ''
        const tb = titleMap.get(b.id) ?? ''
        return ta.localeCompare(tb, undefined, { sensitivity: 'base' })
      })
    }
    case 'largest':
      return sorted.sort((a, b) => b.storage_used_bytes - a.storage_used_bytes)
    default:
      return sorted
  }
}

function computeFiltered(
  sessions: SessionRow[],
  searchQuery: string,
  statusFilter: StatusFilter,
  inputFilters: InputFilter[],
  sortOrder: SortOrder,
  titleMap: Map<string, string>,
): SessionRow[] {
  const q = searchQuery.trim().toLowerCase()

  const filtered = sessions.filter((row) => {
    // 1. Search match
    if (q) {
      const title = (titleMap.get(row.id) ?? '').toLowerCase()
      if (!title.includes(q)) return false
    }
    // 2. Status filter
    const hasKeywords = row.red_zone_count > 0
    if (!matchesStatus(row, statusFilter, hasKeywords)) return false
    // 3. Input filters (AND)
    if (!matchesInputFilters(row, inputFilters)) return false
    return true
  })

  return applySort(filtered, sortOrder, titleMap)
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface State {
  sessions: SessionRow[]
  isLoading: boolean
  searchQuery: string
  statusFilter: StatusFilter
  inputFilters: InputFilter[]
  sortOrder: SortOrder
  filteredSessions: SessionRow[]
  /** Decrypted titles keyed by session id — populated once on mount. */
  titleMap: Map<string, string>
}

interface Actions {
  setSessions(sessions: SessionRow[]): void
  setTitleMap(map: Map<string, string>): void
  setSearchQuery(q: string): void
  setStatusFilter(f: StatusFilter): void
  toggleInputFilter(f: InputFilter): void
  setSortOrder(o: SortOrder): void
  clearFilters(): void
}

const initialState: State = {
  sessions: [],
  isLoading: true,
  searchQuery: '',
  statusFilter: 'all',
  inputFilters: [],
  sortOrder: 'newest',
  filteredSessions: [],
  titleMap: new Map(),
}

function recompute(s: State): SessionRow[] {
  return computeFiltered(
    s.sessions,
    s.searchQuery,
    s.statusFilter,
    s.inputFilters,
    s.sortOrder,
    s.titleMap,
  )
}

export const useDashboardStore = create<State & Actions>()(
  immer((set) => ({
    ...initialState,

    setSessions: (sessions) =>
      set((s) => {
        s.sessions = sessions
        s.isLoading = false
        s.filteredSessions = recompute({ ...s, sessions })
      }),

    setTitleMap: (map) =>
      set((s) => {
        s.titleMap = map
        s.filteredSessions = recompute({ ...s, titleMap: map })
      }),

    setSearchQuery: (q) =>
      set((s) => {
        s.searchQuery = q
        s.filteredSessions = recompute({ ...s, searchQuery: q })
      }),

    setStatusFilter: (f) =>
      set((s) => {
        s.statusFilter = f
        s.filteredSessions = recompute({ ...s, statusFilter: f })
      }),

    toggleInputFilter: (f) =>
      set((s) => {
        const idx = s.inputFilters.indexOf(f)
        const next = idx === -1
          ? [...s.inputFilters, f]
          : s.inputFilters.filter((x) => x !== f)
        s.inputFilters = next
        s.filteredSessions = recompute({ ...s, inputFilters: next })
      }),

    setSortOrder: (o) =>
      set((s) => {
        s.sortOrder = o
        s.filteredSessions = recompute({ ...s, sortOrder: o })
      }),

    clearFilters: () =>
      set((s) => {
        s.statusFilter = 'all'
        s.inputFilters = []
        s.sortOrder = 'newest'
        s.filteredSessions = recompute({
          ...s,
          statusFilter: 'all',
          inputFilters: [],
          sortOrder: 'newest',
        })
      }),
  })),
)
