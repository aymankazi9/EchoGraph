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

function matchesStatus(row: SessionRow, filter: StatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'ready') return row.status === 'ready' || row.status === 'synced'
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
  titleMap: Record<string, string>,
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
        const ta = titleMap[a.id] ?? ''
        const tb = titleMap[b.id] ?? ''
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
  titleMap: Record<string, string>,
): SessionRow[] {
  const q = searchQuery.trim().toLowerCase()

  const filtered = sessions.filter((row) => {
    if (q) {
      const title = (titleMap[row.id] ?? '').toLowerCase()
      if (!title.includes(q)) return false
    }
    if (!matchesStatus(row, statusFilter)) return false
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
  titleMap: Record<string, string>
}

interface Actions {
  setSessions(sessions: SessionRow[]): void
  setTitleMap(map: Map<string, string>): void
  updateTitle(id: string, plainTitle: string): void
  updateSession(id: string, updates: Partial<SessionRow>): void
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
  titleMap: {},
}

export const useDashboardStore = create<State & Actions>()(
  immer((set) => ({
    ...initialState,

    setSessions: (sessions) =>
      set((s) => {
        s.sessions = sessions
        s.isLoading = false
        s.filteredSessions = computeFiltered(sessions, s.searchQuery, s.statusFilter, s.inputFilters, s.sortOrder, s.titleMap)
      }),

    setTitleMap: (map) =>
      set((s) => {
        const record = Object.fromEntries(map)
        s.titleMap = record
        s.filteredSessions = computeFiltered(s.sessions, s.searchQuery, s.statusFilter, s.inputFilters, s.sortOrder, record)
      }),

    updateTitle: (id, plainTitle) =>
      set((s) => {
        s.titleMap[id] = plainTitle
        s.filteredSessions = computeFiltered(s.sessions, s.searchQuery, s.statusFilter, s.inputFilters, s.sortOrder, s.titleMap)
      }),

    updateSession: (id, updates) =>
      set((s) => {
        const idx = s.sessions.findIndex((sess) => sess.id === id)
        if (idx === -1) return
        Object.assign(s.sessions[idx], updates)
        s.filteredSessions = computeFiltered(s.sessions, s.searchQuery, s.statusFilter, s.inputFilters, s.sortOrder, s.titleMap)
      }),

    setSearchQuery: (q) =>
      set((s) => {
        s.searchQuery = q
        s.filteredSessions = computeFiltered(s.sessions, q, s.statusFilter, s.inputFilters, s.sortOrder, s.titleMap)
      }),

    setStatusFilter: (f) =>
      set((s) => {
        s.statusFilter = f
        s.filteredSessions = computeFiltered(s.sessions, s.searchQuery, f, s.inputFilters, s.sortOrder, s.titleMap)
      }),

    toggleInputFilter: (f) =>
      set((s) => {
        const idx = s.inputFilters.indexOf(f)
        const next = idx === -1
          ? [...s.inputFilters, f]
          : s.inputFilters.filter((x) => x !== f)
        s.inputFilters = next
        s.filteredSessions = computeFiltered(s.sessions, s.searchQuery, s.statusFilter, next, s.sortOrder, s.titleMap)
      }),

    setSortOrder: (o) =>
      set((s) => {
        s.sortOrder = o
        s.filteredSessions = computeFiltered(s.sessions, s.searchQuery, s.statusFilter, s.inputFilters, o, s.titleMap)
      }),

    clearFilters: () =>
      set((s) => {
        s.statusFilter = 'all'
        s.inputFilters = []
        s.sortOrder = 'newest'
        s.filteredSessions = computeFiltered(s.sessions, s.searchQuery, 'all', [], 'newest', s.titleMap)
      }),
  })),
)
