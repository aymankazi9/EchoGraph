// Per-run enhancement progress, keyed by sessionId.
// Updated from flashcard-enhancer.ts callbacks; consumed by EnhancementOverlay.
// State is always for ONE session at a time — startRun replaces any prior run.

import { create } from 'zustand'

interface EnhancementState {
  sessionId: string | null
  isRunning: boolean
  /** Cards whose batch has been dispatched (not necessarily successfully enhanced). */
  completed: number
  /** Total cards sent to the enhancement pipeline this run. */
  total: number
  /** Date.now() at run start — used to compute elapsed seconds for timers. */
  startedAt: number | null
  /** True once the user has escaped or the run has ended / timed out. */
  dismissed: boolean
  /** True specifically after the 180s hard timeout — triggers the retry banner. */
  timedOut: boolean
}

interface EnhancementActions {
  /** Begin a new run; clears all prior state for this session. */
  startRun(sessionId: string, total: number): void
  /** Increment completed count after each batch resolves. */
  batchCompleted(count: number): void
  /** Called after all batches complete — clears isRunning. */
  endRun(): void
  /** User clicked the escape-hatch link — hides overlay, no banner. */
  dismiss(): void
  /** 180s wall-clock timeout — hides overlay, shows retry banner. */
  timeout(): void
  /** Clear dismissed/timedOut so the auto-start effect can re-trigger. */
  retryRun(): void
}

export const useEnhancementStore = create<EnhancementState & EnhancementActions>()((set) => ({
  sessionId: null,
  isRunning: false,
  completed: 0,
  total: 0,
  startedAt: null,
  dismissed: false,
  timedOut: false,

  startRun: (sessionId, total) =>
    set({ sessionId, isRunning: true, completed: 0, total, startedAt: Date.now(), dismissed: false, timedOut: false }),

  batchCompleted: (count) =>
    set((s) => ({ completed: Math.min(s.total, s.completed + count) })),

  endRun: () => set({ isRunning: false }),

  dismiss: () => set({ isRunning: false, dismissed: true, timedOut: false }),

  timeout: () => set({ isRunning: false, dismissed: true, timedOut: true }),

  retryRun: () => set({ dismissed: false, timedOut: false }),
}))
