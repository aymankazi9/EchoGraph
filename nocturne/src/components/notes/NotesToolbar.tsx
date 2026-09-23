'use client'

// Fixed toolbar + selection bubble menu for the Notes Tiptap editor.
//
// Both components share the same underlying editor commands and active-state
// checks so that all three input paths — keyboard shortcut, toolbar click, and
// bubble menu click — stay in sync via editor.isActive().
//
// Toolbar buttons use onMouseDown + e.preventDefault() to keep focus (and
// therefore the selection) in the editor when clicked.  The bubble menu uses
// the same pattern so it doesn't disappear mid-click.
//
// Underline persistence: tiptap-markdown has no native underline syntax, so it
// falls back to HTMLMark serialisation → <u>text</u> in the stored markdown
// (only when html:true, which is what the editor is configured with).
// markdown-it passes <u> through verbatim; ProseMirror's DOMParser restores the
// Underline mark via parseHTML:[{tag:"u"}].  Full round-trip confirmed.

import { createPortal } from 'react-dom'
import { useState, useEffect, useRef } from 'react'
import type { Editor } from '@tiptap/react'

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      // e.preventDefault() keeps the editor focused and the selection intact.
      // All action is in onMouseDown; there is no onClick handler.
      onMouseDown={(e) => {
        e.preventDefault()
        if (!disabled) onClick()
      }}
      style={{
        width: 28,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: active ? '#A5B4FC' : disabled ? '#2D2B45' : '#5B6478',
        transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

function Separator() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: '#1E1E2E',
        margin: '0 3px',
        flexShrink: 0,
      }}
    />
  )
}

// The <select> can't use onMouseDown+preventDefault because that blocks the
// dropdown from opening.  Instead, onChange calls editor.chain().focus() to
// restore the editor selection before executing the heading command.
function HeadingSelect({ editor, compact = false }: { editor: Editor; compact?: boolean }) {
  const value =
    editor.isActive('heading', { level: 1 }) ? 'h1' :
    editor.isActive('heading', { level: 2 }) ? 'h2' :
    editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'

  const isHeading = value !== 'p'

  return (
    <select
      value={value}
      onChange={(e) => {
        const v = e.target.value
        if (v === 'p')  editor.chain().focus().setParagraph().run()
        if (v === 'h1') editor.chain().focus().setHeading({ level: 1 }).run()
        if (v === 'h2') editor.chain().focus().setHeading({ level: 2 }).run()
        if (v === 'h3') editor.chain().focus().setHeading({ level: 3 }).run()
      }}
      style={{
        background: '#0D0D14',
        color: isHeading ? '#A5B4FC' : '#5B6478',
        border: `1px solid ${isHeading ? 'rgba(99,102,241,0.3)' : '#1E1E2E'}`,
        borderRadius: 5,
        fontSize: 11.5,
        fontWeight: 500,
        padding: compact ? '0 5px' : '0 7px',
        height: 28,
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        minWidth: compact ? 52 : 72,
        fontFamily: 'inherit',
      }}
    >
      <option value="p">{compact ? 'Text' : 'Normal'}</option>
      <option value="h1">H1</option>
      <option value="h2">H2</option>
      <option value="h3">H3</option>
    </select>
  )
}

function handleLink(editor: Editor) {
  if (editor.isActive('link')) {
    editor.chain().focus().unsetLink().run()
    return
  }
  // eslint-disable-next-line no-alert
  const raw = window.prompt('Link URL:')
  if (!raw) return
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  editor.chain().focus().setLink({ href, target: '_blank' }).run()
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

function Svg({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {d && <path d={d} />}
      {children}
    </svg>
  )
}

const BulletListIcon = () => (
  <Svg>
    <circle cx="2.5" cy="4.5"  r="1" fill="currentColor" stroke="none" />
    <circle cx="2.5" cy="8"    r="1" fill="currentColor" stroke="none" />
    <circle cx="2.5" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <path d="M5.5 4.5h9M5.5 8h9M5.5 11.5h9" />
  </Svg>
)

const OrderedListIcon = () => (
  // Don't use <Svg> here — the <text> element needs fill/stroke overrides that
  // conflict with the wrapper's SVG-level fill="none" / stroke="currentColor".
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {/* "1" rendered via the system font — crisp at any size, no path-drawing. */}
    <text x="1" y="11.5" fontSize="10" fontWeight="700" fontFamily="inherit" fill="currentColor" stroke="none">1</text>
    <path d="M7 4.5h8M7 8h8M7 11.5h8" />
  </svg>
)

const BlockquoteIcon = () => (
  <Svg>
    {/* left vertical bar + indented text lines */}
    <path d="M2 4v8" strokeWidth="2.5" />
    <path d="M5.5 6h8M5.5 10h6" />
  </Svg>
)

const LinkIcon = () => (
  <Svg>
    <path d="M6.5 9.5a3.2 3.2 0 004.6 0l2-2a3.2 3.2 0 00-4.5-4.5L7 4.6" />
    <path d="M9.5 6.5a3.2 3.2 0 00-4.6 0l-2 2a3.2 3.2 0 004.5 4.5L9 11.4" />
  </Svg>
)

const UndoIcon = () => <Svg d="M3.5 8H10a3 3 0 110 6H8M3.5 8l3-3M3.5 8l3 3" />
const RedoIcon = () => <Svg d="M12.5 8H6a3 3 0 000 6h2M12.5 8l-3-3M12.5 8l-3 3" />

// ─── Highlight picker ─────────────────────────────────────────────────────────

const SWATCHES = [
  { color: '#fef08a', label: 'Yellow'  },
  { color: '#86efac', label: 'Green'   },
  { color: '#f9a8d4', label: 'Pink'    },
  { color: '#93c5fd', label: 'Blue'    },
] as const

// Horizontal marker shape — rectangle body with a pointed right tip.
const HighlightIcon = () => (
  <Svg>
    <path d="M2 6.5h11l2 1.5-2 1.5H2z" />
    <path d="M1 12h14" />
  </Svg>
)

// Highlight button with a portal-rendered color-swatch dropdown.
//
// The panel uses createPortal → document.body with position:fixed coordinates
// computed from getBoundingClientRect().  This escapes the toolbar's
// overflow-x:auto container (which implicitly clips overflow-y too) — the same
// technique used by NotesBubbleMenu.
//
// The parent toolbar subscribes to 'transaction' and forces a full re-render, so
// activeColor stays in sync with cursor position without extra subscriptions here.
function HighlightBtn({ editor }: { editor: Editor }) {
  const [open, setOpen]     = useState(false)
  const [pos,  setPos]      = useState({ top: 0, left: 0 })
  const buttonRef           = useRef<HTMLButtonElement>(null)
  const panelRef            = useRef<HTMLDivElement>(null)

  const activeColor: string | undefined = editor.isActive('highlight')
    ? (editor.getAttributes('highlight').color as string | undefined)
    : undefined

  // Close on outside mousedown
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        buttonRef.current?.contains(t) === false &&
        panelRef.current?.contains(t) === false
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault() // keep editor focused
    if (!open && buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left + r.width / 2 })
    }
    setOpen((v) => !v)
  }

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#0D0D14',
        border: '1px solid #1E1E2E',
        borderRadius: 8,
        padding: '5px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
    >
      {SWATCHES.map(({ color, label }) => (
        <button
          key={color}
          type="button"
          title={label}
          aria-label={`Highlight ${label}`}
          onMouseDown={(e) => {
            e.preventDefault()
            editor.chain().focus().toggleHighlight({ color }).run()
            setOpen(false)
          }}
          style={{
            width: 18,
            height: 18,
            borderRadius: 3,
            background: color,
            border: `2px solid ${activeColor === color ? 'rgba(255,255,255,0.75)' : 'transparent'}`,
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            transition: 'border-color 0.1s',
          }}
        />
      ))}

      {/* Remove highlight */}
      <button
        type="button"
        title="Remove highlight"
        aria-label="Remove highlight"
        onMouseDown={(e) => {
          e.preventDefault()
          editor.chain().focus().unsetHighlight().run()
          setOpen(false)
        }}
        style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          background: 'transparent',
          border: '1px solid #2D2B45',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#5B6478',
          fontSize: 10,
          lineHeight: 1,
          padding: 0,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title={activeColor ? `Highlight (${activeColor})` : 'Highlight'}
        onMouseDown={handleToggle}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          border: 'none',
          borderRadius: 5,
          cursor: 'pointer',
          background: open || activeColor ? 'rgba(99,102,241,0.15)' : 'transparent',
          color:      open || activeColor ? '#A5B4FC' : '#5B6478',
          transition: 'background 0.1s, color 0.1s',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <HighlightIcon />
        {/* 10×2 px bar in the active swatch color */}
        <span style={{
          display: 'block',
          width: 10,
          height: 2,
          borderRadius: 1,
          background: activeColor ?? 'transparent',
          flexShrink: 0,
          transition: 'background 0.15s',
        }} />
      </button>

      {open && createPortal(panel, document.body)}
    </>
  )
}

// ─── Fixed toolbar ─────────────────────────────────────────────────────────────

// Re-renders on every editor transaction so isActive() / can() stay in sync.
export function NotesToolbar({ editor }: { editor: Editor | null }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!editor) return
    const sync = () => setTick((n) => n + 1)
    editor.on('transaction', sync)
    return () => { editor.off('transaction', sync) }
  }, [editor])

  if (!editor) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        padding: '3px 4px',
        borderBottom: '1px solid #0F0F18',
        background: '#09090F',
        flexShrink: 0,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {/* ── Inline marks ──────────────────────────────────────────────────── */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Bold (⌘B)">
        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1 }}>B</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Italic (⌘I)">
        <span style={{ fontStyle: 'italic', fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1 }}>I</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)">
        <span style={{ textDecoration: 'underline', fontSize: 13, lineHeight: 1 }}>U</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()}    active={editor.isActive('strike')}    title="Strikethrough">
        <span style={{ textDecoration: 'line-through', fontSize: 13, lineHeight: 1 }}>S</span>
      </ToolbarBtn>

      <Separator />

      {/* ── Heading level ─────────────────────────────────────────────────── */}
      <HeadingSelect editor={editor} />

      <Separator />

      {/* ── Block formats ─────────────────────────────────────────────────── */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Bullet list">
        <BulletListIcon />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">
        <OrderedListIcon />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}  active={editor.isActive('blockquote')}  title="Blockquote">
        <BlockquoteIcon />
      </ToolbarBtn>

      <Separator />

      {/* ── Link ──────────────────────────────────────────────────────────── */}
      <ToolbarBtn
        onClick={() => handleLink(editor)}
        active={editor.isActive('link')}
        title={editor.isActive('link') ? 'Remove link' : 'Add link (⌘K)'}
      >
        <LinkIcon />
      </ToolbarBtn>

      {/* ── Highlight ─────────────────────────────────────────────────────── */}
      <HighlightBtn editor={editor} />

      {/* Push undo/redo to the right */}
      <div style={{ flex: 1 }} />

      {/* ── History ───────────────────────────────────────────────────────── */}
      <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (⌘Z)">
        <UndoIcon />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (⌘⇧Z)">
        <RedoIcon />
      </ToolbarBtn>
    </div>
  )
}

// ─── Selection bubble menu ─────────────────────────────────────────────────────

// Appears above a non-empty text selection using a fixed-position portal so
// scrolling and stacking contexts don't affect placement.  Disappears when
// the selection collapses or the editor blurs.
//
// The transaction subscription re-renders the component so isActive() stays
// current as formatting is toggled (even without a selection-position change).

export function NotesBubbleMenu({ editor }: { editor: Editor | null }) {
  // Viewport-relative centre-top of the current selection.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  // Tick counter forces re-render when editor state changes so active marks sync.
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!editor) return

    const handleSelectionUpdate = () => {
      if (editor.state.selection.empty) {
        setPos(null)
        return
      }
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) { setPos(null); return }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (!rect.width && !rect.height) { setPos(null); return }
      setPos({ x: rect.left + rect.width / 2, y: rect.top })
    }

    const handleTransaction = () => setTick((n) => n + 1)
    const handleBlur       = () => setPos(null)

    editor.on('selectionUpdate', handleSelectionUpdate)
    editor.on('transaction',     handleTransaction)
    editor.on('blur',            handleBlur)

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate)
      editor.off('transaction',     handleTransaction)
      editor.off('blur',            handleBlur)
    }
  }, [editor])

  if (!pos || !editor) return null

  const menu = (
    <div
      style={{
        position: 'fixed',
        top: pos.y,
        left: pos.x,
        // Centre horizontally, lift above the selection with an 8px gap
        transform: 'translate(-50%, calc(-100% - 8px))',
        zIndex: 9999,
        background: '#0D0D14',
        border: '1px solid #1E1E2E',
        borderRadius: 8,
        padding: '3px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        boxShadow: '0 8px 28px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.3)',
        pointerEvents: 'auto',
      }}
    >
      {/* ── Inline marks ────────────────────────────────────────────────── */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Bold (⌘B)">
        <span style={{ fontWeight: 700, fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1 }}>B</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Italic (⌘I)">
        <span style={{ fontStyle: 'italic', fontSize: 13, fontFamily: 'Georgia, serif', lineHeight: 1 }}>I</span>
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)">
        <span style={{ textDecoration: 'underline', fontSize: 13, lineHeight: 1 }}>U</span>
      </ToolbarBtn>

      <Separator />

      {/* ── Heading level ───────────────────────────────────────────────── */}
      <HeadingSelect editor={editor} compact />

      <Separator />

      {/* ── Link ────────────────────────────────────────────────────────── */}
      <ToolbarBtn
        onClick={() => handleLink(editor)}
        active={editor.isActive('link')}
        title={editor.isActive('link') ? 'Remove link' : 'Add link'}
      >
        <LinkIcon />
      </ToolbarBtn>

      {/* ── Highlight ───────────────────────────────────────────────────── */}
      <HighlightBtn editor={editor} />
    </div>
  )

  // Portal ensures fixed positioning works regardless of transform/overflow on ancestors.
  return createPortal(menu, document.body)
}
