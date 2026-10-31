'use client'

// NotesVersionHistory — overlay panel showing note snapshots.
//
// Layout: two-column overlay covering the notes editor area.
//   Left column  — scrollable version list with timestamps and kind badges.
//   Right column — read-only Tiptap preview of the selected version.
//   Footer       — Restore button (disabled until a version is selected).
//
// Restore flow: select → decrypt → preview → confirm → onRestore(markdown).
// The parent takes a pre-restore snapshot of the current content before
// applying the restore, so the user can always undo via the history panel again.

import { useState, useEffect, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { getMasterKey } from '@/lib/crypto/vault'
import { decryptText } from '@/lib/crypto/decrypt'
import { createClient } from '@/lib/supabase'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VersionRow {
  id: string
  content_encrypted: string
  kind: 'auto' | 'generate'
  created_at: string
}

interface Props {
  sessionId: string
  /** Called with the decrypted markdown when the user confirms a restore. */
  onRestore: (markdown: string) => Promise<void>
  onClose: () => void
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): { line1: string; line2: string } {
  const d = new Date(iso)
  const now = new Date()

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  let line1: string
  if (sameDay(d, now)) {
    line1 = 'Today'
  } else if (sameDay(d, yesterday)) {
    line1 = 'Yesterday'
  } else {
    line1 = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return { line1, line2: `at ${timeStr}` }
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function NotesVersionHistory({ sessionId, onRestore, onClose }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [versions, setVersions]         = useState<VersionRow[]>([])
  const [loadingList, setLoadingList]   = useState(true)
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [previewText, setPreviewText]   = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [restoring, setRestoring]       = useState(false)
  const [loadError, setLoadError]       = useState(false)

  // Read-only Tiptap editor for the right-side preview.
  // Only StarterKit + Markdown — the slide-ref and keyword extensions aren't
  // needed here (this is display-only) and would pull in extra deps.
  const previewEditor = useEditor({
    immediatelyRender: true,
    editable: false,
    extensions: [
      StarterKit,
      Markdown.configure({ html: true, tightLists: true }),
    ],
    content: '',
    editorProps: {
      attributes: { class: 'notes-tiptap notes-tiptap--preview' },
    },
  })

  // ── Load version list on mount ──────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('session_notes_versions')
        .select('id, content_encrypted, kind, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) {
        setLoadError(true)
      } else {
        setVersions((data ?? []) as VersionRow[])
      }
      setLoadingList(false)
    })()
  }, [sessionId, supabase])

  // ── Select a version: decrypt and load into the preview editor ──────────────

  const handleSelect = async (row: VersionRow) => {
    if (row.id === selectedId) return
    setSelectedId(row.id)
    setPreviewText(null)
    setLoadingPreview(true)

    const mk = getMasterKey()
    if (!mk) {
      setLoadingPreview(false)
      return
    }
    try {
      const plain = await decryptText(mk, row.content_encrypted)
      setPreviewText(plain)
      previewEditor?.commands.setContent(plain, { emitUpdate: false })
    } catch {
      setPreviewText(null)
    }
    setLoadingPreview(false)
  }

  // ── Confirm restore ─────────────────────────────────────────────────────────

  const handleRestore = async () => {
    if (!previewText) return
    setRestoring(true)
    try {
      await onRestore(previewText)
    } finally {
      setRestoring(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const selectedVersion = versions.find((v) => v.id === selectedId)

  return (
    <>
      {/* Extra preview styles — the base .notes-tiptap block is in notes-editor.tsx */}
      <style>{`
        .notes-tiptap--preview {
          font-size: 13.5px;
          line-height: 1.75;
          pointer-events: none;
          user-select: text;
        }
        .notes-tiptap--preview h1,
        .notes-tiptap--preview h2,
        .notes-tiptap--preview h3 { margin-top: 0.6em; }
      `}</style>

      {/* Full-area overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0A0A0A',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 'inherit',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="#76767B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="10" cy="10" r="8" />
              <path d="M10 6v4l3 3" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#EDEDED', letterSpacing: '-0.01em' }}>
              Version history
            </span>
            {versions.length > 0 && (
              <span style={{ fontSize: 11, color: '#76767B', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2, padding: '1px 7px' }}>
                {versions.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#76767B', padding: 4, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            aria-label="Close version history"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

          {/* ── Left: version list ──────────────────────────────────────────────── */}
          <div
            style={{
              width: 200,
              flexShrink: 0,
              borderRight: '1px solid rgba(255,255,255,0.08)',
              overflowY: 'auto',
              padding: '8px 0',
            }}
          >
            {loadingList ? (
              <div style={{ padding: '20px 16px', fontSize: 12, color: '#76767B' }}>Loading…</div>
            ) : loadError ? (
              <div style={{ padding: '20px 16px', fontSize: 12, color: '#FF3B30' }}>Failed to load versions.</div>
            ) : versions.length === 0 ? (
              <div style={{ padding: '20px 16px', fontSize: 12, color: '#76767B', lineHeight: 1.6 }}>
                No saved versions yet.
                <br />
                Snapshots appear here after 5 minutes of editing or when AI notes are generated.
              </div>
            ) : (
              versions.map((v) => {
                const { line1, line2 } = formatTimestamp(v.created_at)
                const isSelected = v.id === selectedId
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => void handleSelect(v)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      width: '100%',
                      padding: '9px 14px',
                      background: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                      borderLeft: `2px solid ${isSelected ? '#FF3B30' : 'transparent'}`,
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 12, color: isSelected ? '#EDEDED' : '#9A9A9F', fontWeight: isSelected ? 500 : 400 }}>
                      {line1}
                    </span>
                    <span style={{ fontSize: 11, color: '#76767B' }}>{line2}</span>
                    {v.kind === 'generate' && (
                      <span style={{ fontSize: 10, color: '#76767B', marginTop: 2, fontWeight: 500 }}>✦ AI generated</span>
                    )}
                  </button>
                )
              })
            )}
          </div>

          {/* ── Right: preview ──────────────────────────────────────────────────── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {!selectedId ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4A4A4E', fontSize: 13, padding: 24, textAlign: 'center' }}>
                Select a version on the left to preview its content.
              </div>
            ) : loadingPreview ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#76767B', fontSize: 13 }}>
                Decrypting…
              </div>
            ) : previewText === null ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30', fontSize: 13 }}>
                Could not decrypt this version. Is the vault unlocked?
              </div>
            ) : (
              <>
                {/* Preview header */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                  {selectedVersion && (() => {
                    const { line1, line2 } = formatTimestamp(selectedVersion.created_at)
                    return (
                      <span style={{ fontSize: 11, color: '#76767B' }}>
                        {line1} {line2}
                        {selectedVersion.kind === 'generate' && <span style={{ color: '#76767B', marginLeft: 8 }}>✦ AI generated</span>}
                      </span>
                    )
                  })()}
                </div>

                {/* Read-only editor */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px' }}>
                  <EditorContent editor={previewEditor} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 16px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 11, color: '#4A4A4E', lineHeight: 1.5 }}>
            Restoring saves the current state as a snapshot first,<br />so you can always come back.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ height: 32, padding: '0 14px', borderRadius: 2, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#76767B', fontSize: 13, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={previewText === null || restoring}
              onClick={() => void handleRestore()}
              style={{
                height: 32,
                padding: '0 16px',
                borderRadius: 2,
                border: 'none',
                background: previewText !== null && !restoring ? '#FF3B30' : '#0C0C0D',
                color: previewText !== null && !restoring ? '#0A0A0A' : '#4A4A4E',
                fontSize: 13,
                fontWeight: 500,
                cursor: previewText !== null && !restoring ? 'pointer' : 'default',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {restoring ? 'Restoring…' : 'Restore to this version'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
