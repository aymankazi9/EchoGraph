# Component Inventory — Keep / Modify / New

Mapping the designs onto the existing `src/components/` tree. **Reuse and restyle before
rebuilding.** Only create new components where there's genuinely no equivalent.

## Legend
- ✅ **Keep+restyle** — exists, conforms or needs only token/spacing fixes
- 🔧 **Modify** — exists but needs structural/behavioral change to match mock
- 🆕 **New** — build from scratch
- ❌ **Delete** — superseded; remove after its replacement lands

---

## App shell & nav (`src/components/nav/`)
| Component | Action | Notes |
|---|---|---|
| `app-shell.tsx` | ✅ | Wraps app routes; ensure it now hosts `/momentum` and `/community`. |
| `side-nav.tsx` | 🔧 | **Add Momentum + Community** to `NAV_ITEMS` (icons `Flame`/`Zap`, `Users`). Order: Vault · Momentum · Community · New session · … · Settings. Active = `rgba(99,102,241,0.13)` / `#C7CEF5`. |
| `nav-item.tsx` | ✅ | Matches mock (38px, rounded-md). |
| `privacy-badge.tsx` | ✅ | "Zero-knowledge encrypted" — already correct. |
| `storage-indicator.tsx`, `user-row.tsx`, `notification-strip.tsx` | ✅ | Restyle to surface ladder. |

## Dashboard (`src/components/dashboard/`)
| Component | Action | Notes |
|---|---|---|
| `vault-dashboard-client.tsx` | 🔧 | Multi-view host. Add the **ambient momentum ribbon** above the resume card. |
| `session-card.tsx` + `-skeleton` | 🔧 | Title 19px, Red Zone count (rose), mastery bar, inline rename, last-opened. |
| `empty-state.tsx`, `empty-filtered-state.tsx` | ✅ | Match mock empty view. |
| `filter-chips.tsx`, `sort-control.tsx`, `vault-search.tsx`, `getting-started.tsx` | ✅ | Restyle. |
| **`momentum-ribbon.tsx`** | 🆕 | The ambient streak/balance ribbon → links `/momentum`. |

## Session workspace (`src/components/{session,transcript,study-guide,pdf,audio}/`)
| Component | Action | Notes |
|---|---|---|
| `session-title.tsx`, `guided-empty-state.tsx`, `decryption-overlay.tsx`, `keyboard-shortcut-overlay.tsx`, `domain-prompt.tsx` | ✅ | Restyle. |
| `transcript/{transcript-pane,transcription-controls,word-span}.tsx` | 🔧 | Red Zone token highlight (`#FDA4AF` on `rgba(251,113,133,0.12)`). |
| `pdf/{pdf-viewer,slide-nav-strip,page-controls}.tsx` | ✅ | Slide viewer in Lecture mode. |
| `audio/{audio-player,seek-bar}.tsx` | 🔧 | Feed the **unified timeline spine** (ticks, indigo fill, `#A5B4FC` playhead). |
| `study-guide/{flashcard-panel,keyword-chip-row,keyword-side-panel,guide-upload}.tsx` | 🔧 | Flashcard drill + SM-2 rating buttons (Again/Hard/Good/Easy). |
| **`mode-tabs.tsx`** | 🆕 | Lecture · Study · Notes · Ask switcher in the top bar. |
| **`timeline-spine.tsx`** | 🆕 | The synced scrub spine with ribbon toggle (Transcript / Red Zone density). |
| **`ask-panel.tsx`** | 🆕 | Grounded Q&A mode (citations, suggestion chips). |

## Ingestion (`src/components/ingestion/`)
| Component | Action | Notes |
|---|---|---|
| `drop-zone.tsx`, `upload-panel.tsx`, `progress-stack.tsx`, `url-input.tsx` | ✅ | New-session view; keep the contextual unlock hints. |

## Marketing / auth / errors
| Area | Action | Notes |
|---|---|---|
| `src/components/landing/*` | 🔧 | Reconcile each against the landing mock (it's the furthest-built page). |
| `src/components/marketing/*` (help-accordion, footer, nav-bar, pricing, stub-page…) | 🔧 | Help Center + Legal + pricing parity. |
| `login/page.tsx`, `(vault)/unlock`, `ui/passphrase-input.tsx` | 🔧 | Two-panel login; passphrase unlock. |
| `(vault)/setup` + `onboarding/{onboarding-progress,recovery-modal}.tsx` | 🔧 | 4-step signup w/ strength meter + Recovery Kit. |
| `(app)/not-found.tsx`, `error.tsx` (app + marketing) | 🔧 | 404 / 500 to match mocks; 500 uses `reset()`. |

## NEW feature components
| Component | Action | Notes |
|---|---|---|
| `momentum/streak-hero.tsx` | 🆕 | Streak band + 7-day strip + next milestone. |
| `momentum/activity-heatmap.tsx` | 🆕 | 17×7 indigo heatmap from session timestamps. |
| `momentum/momentum-wallet.tsx` | 🆕 | Balance + redeem (real-utility items). |
| `momentum/mastery-rings.tsx` | 🆕 | Conic-gradient mastery-by-subject. |
| `momentum/milestones.tsx` | 🆕 | Earned/locked list. |
| `momentum/course-circle.tsx` | 🆕 | Opt-in cohort widget → links `/community`. |
| `community/room-card.tsx`, `room-panel.tsx`, `pooled-keywords.tsx`, `study-threads.tsx`, `shared-deck-card.tsx`, `room-discover.tsx`, `school-picker.tsx` | 🆕 | Course-room surface. |

## shadcn primitives (`src/components/ui/`)
Keep all (`button, dialog, accordion, select, slider, tooltip, checkbox, dropdown-menu,
alert-dialog, separator, passphrase-input`). Restyle variants to the token scale where they
diverge (radii, surfaces). Heatmap, rings, timeline spine are bespoke — not shadcn.

## Deletions
Delete only **after** a replacement is verified. Likely candidates once restyled: none of the
existing components are obsolete — they map to the redesign. If during reconciliation you find a
landing/marketing component with no place in the mock, remove it then. Don't pre-emptively delete.
