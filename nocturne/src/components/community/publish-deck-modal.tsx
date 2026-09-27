'use client'

// PublishDeckModal — lets an Eclipse-tier user publish a session's flashcards
// to one of their joined community rooms as a plaintext shared deck.
//
// The flashcards are already decrypted in the session store when this modal opens,
// so no vault unlock is required here.

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Flashcard } from '@/lib/scoring/flashcard-generator'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Room { room_id: string; display_name: string; course_code: string }
type ZoneFilter = 'all' | 'red' | 'likely'
type Step = 'idle' | 'publishing' | 'done' | 'error'

interface Props {
  sessionId:    string
  sessionTitle: string
  flashcards:   Flashcard[]
  onClose:      () => void
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 4 L14 14 M14 4 L4 14" />
  </svg>
)

const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="14" cy="4"  r="2" />
    <circle cx="4"  cy="9"  r="2" />
    <circle cx="14" cy="14" r="2" />
    <path d="M6 10 L12 13 M6 8 L12 5" />
  </svg>
)

// ── Component ─────────────────────────────────────────────────────────────────

export function PublishDeckModal({ sessionId, sessionTitle, flashcards, onClose }: Props) {
  const supabase = createClient()

  const [rooms,          setRooms]          = useState<Room[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<string>('')
  const [title,          setTitle]          = useState(sessionTitle)
  const [zoneFilter,     setZoneFilter]     = useState<ZoneFilter>('all')
  const [step,           setStep]           = useState<Step>('idle')
  const [error,          setError]          = useState<string | null>(null)

  // Fetch joined rooms once on mount
  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_joined_rooms')
      const list = (data ?? []) as Room[]
      setRooms(list)
      if (list.length === 1) setSelectedRoomId(list[0]!.room_id)
    }
    load().catch(console.error)
  }, [supabase])

  // Derived: cards that will be sent
  const filteredCards = flashcards.filter((c) =>
    zoneFilter === 'all' ? true : c.zone === zoneFilter,
  )
  const selectedRoom = rooms.find((r) => r.room_id === selectedRoomId) ?? null

  async function handlePublish() {
    if (!selectedRoomId || filteredCards.length === 0 || !title.trim()) return
    setStep('publishing')
    setError(null)
    try {
      const res = await fetch('/api/community/publish-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          roomId: selectedRoomId,
          title:  title.trim(),
          cards:  filteredCards.map((c) => ({ front: c.front, back: c.back, zone: c.zone })),
        }),
      })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        throw new Error(json.error ?? `HTTP ${res.status}`)
      }
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed')
      setStep('error')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxWidth: 'calc(100vw - 32px)',
          background: '#0F0F18',
          border: '1px solid #22213A',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px 16px',
          borderBottom: '1px solid #1A1A2E',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ color: '#818CF8' }}><ShareIcon /></div>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>
              Publish deck to room
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 26, height: 26, borderRadius: 7,
              border: 'none', background: 'transparent',
              color: '#4A5568', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <XIcon />
          </button>
        </div>

        {step === 'done' ? (
          // ── Success state ───────────────────────────────────────────────────
          <div style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎉</div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#CBD5E1', marginBottom: 6 }}>
              Deck published
            </p>
            <p style={{ fontSize: 12.5, color: '#4A5568', marginBottom: 24 }}>
              {filteredCards.length} cards are now visible to members of{' '}
              <strong style={{ color: '#94A3B8' }}>{selectedRoom?.display_name ?? 'the room'}</strong>.
            </p>
            <button
              onClick={onClose}
              style={{
                height: 36, padding: '0 20px', borderRadius: 9,
                border: 'none', background: '#6366F1',
                color: '#E2E8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        ) : (
          // ── Publish form ────────────────────────────────────────────────────
          <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Room selector */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#4A5568', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                Room
              </label>
              {rooms.length === 0 ? (
                <p style={{ fontSize: 12.5, color: '#3F485C', margin: 0 }}>
                  You haven&apos;t joined any rooms yet. Join a room from the Community page first.
                </p>
              ) : rooms.length === 1 ? (
                <div style={{
                  padding: '9px 12px', borderRadius: 9,
                  border: '1px solid #22213A', background: '#0C0C14',
                  fontSize: 12.5, color: '#CBD5E1',
                }}>
                  {rooms[0]!.display_name}
                </div>
              ) : (
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  style={{
                    width: '100%', height: 38, padding: '0 12px',
                    borderRadius: 9, border: '1px solid #22213A',
                    background: '#0C0C14', color: '#CBD5E1', fontSize: 13,
                    cursor: 'pointer', appearance: 'none',
                  }}
                >
                  <option value="" disabled>Select a room…</option>
                  {rooms.map((r) => (
                    <option key={r.room_id} value={r.room_id}>{r.display_name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Deck title */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#4A5568', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                Deck title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a deck title…"
                maxLength={120}
                style={{
                  width: '100%', height: 38, padding: '0 12px',
                  borderRadius: 9, border: '1px solid #22213A',
                  background: '#0C0C14', color: '#CBD5E1', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Zone filter */}
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: '#4A5568', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 7 }}>
                Cards to include
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['all', 'red', 'likely'] as ZoneFilter[]).map((z) => {
                  const label  = z === 'all' ? `All (${flashcards.length})` : z === 'red' ? `Red Zone (${flashcards.filter(c => c.zone === 'red').length})` : `Likely (${flashcards.filter(c => c.zone === 'likely').length})`
                  const active = zoneFilter === z
                  return (
                    <button
                      key={z}
                      onClick={() => setZoneFilter(z)}
                      style={{
                        height: 30, padding: '0 12px', borderRadius: 8, cursor: 'pointer',
                        border: active ? '1px solid rgba(244,63,94,0.5)' : '1px solid #22213A',
                        background: active ? 'rgba(244,63,94,0.12)' : 'transparent',
                        color:  active ? '#FB7185' : '#4A5568',
                        fontSize: 12, fontWeight: active ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Consent notice */}
            <div style={{
              borderRadius: 10,
              border: '1px solid rgba(251,191,36,0.25)',
              background: 'rgba(251,191,36,0.05)',
              padding: '11px 13px',
              display: 'flex', gap: 10,
            }}>
              <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
              <p style={{ fontSize: 12, color: '#D4A908', margin: 0, lineHeight: 1.55 }}>
                <strong>This deck&apos;s content will be visible to other members of this room,
                unlike your private vault.</strong>{' '}
                Published cards are stored as plaintext and cannot be retracted once other
                members have viewed them.
              </p>
            </div>

            {/* Error */}
            {step === 'error' && error && (
              <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>{error}</p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', paddingTop: 2 }}>
              <button
                onClick={onClose}
                style={{
                  height: 36, padding: '0 16px', borderRadius: 9,
                  border: '1px solid #22213A', background: 'transparent',
                  color: '#4A5568', fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={
                  step === 'publishing' ||
                  !selectedRoomId ||
                  filteredCards.length === 0 ||
                  !title.trim()
                }
                style={{
                  height: 36, padding: '0 18px', borderRadius: 9,
                  border: 'none',
                  background: (step === 'publishing' || !selectedRoomId || filteredCards.length === 0 || !title.trim())
                    ? '#1A1A2E'
                    : '#6366F1',
                  color: (step === 'publishing' || !selectedRoomId || filteredCards.length === 0 || !title.trim())
                    ? '#3A4155'
                    : '#E2E8F0',
                  fontSize: 13, fontWeight: 600,
                  cursor: (step === 'publishing' || !selectedRoomId || filteredCards.length === 0 || !title.trim())
                    ? 'not-allowed'
                    : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 7,
                  transition: 'background 0.15s',
                }}
              >
                <ShareIcon />
                {step === 'publishing' ? 'Publishing…' : `Publish ${filteredCards.length} card${filteredCards.length !== 1 ? 's' : ''}`}
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
