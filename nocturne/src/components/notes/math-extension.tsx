'use client'

// KaTeX-based math extension for the Notes Tiptap editor.
//
// Provides two atom nodes:
//   • InlineMath  — $E=mc^2$ shortcut + NodeView rendering
//   • BlockMath   — $$E=mc^2$$ shortcut + NodeView rendering (display mode)
//
// Markdown round-trip (via tiptap-markdown v0.9):
//   Serialiser  → writes  $latex$  /  $$\nlatex\n$$
//   Parser      → markdown-it plugin converts those back to span/div data attrs
//                 which parseHTML rules map to the node types
//
// Editing UX:
//   Clicking any rendered math node opens an inline editing popover.
//   The toolbar "Insert equation" button inserts new math at the cursor.

import { Node, InputRule } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import katex from 'katex'
import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'

// ── Markdown-it plugin ──────────────────────────────────────────────────────
// Added once (idempotent) via the setup hook called by tiptap-markdown's parser.
// Converts  $latex$  →  <span data-math-inline="latex">
//           $$latex$$  →  <div data-math-display="latex">

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mathMarkdownPlugin(md: any) {
  if (md.__mathPluginAdded) return
  md.__mathPluginAdded = true

  // ── Block math: $$...$$ (single-line) or $$\n...\n$$ (multi-line) ─────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.block.ruler.before('fence', 'math_block', (state: any, startLine: number, endLine: number, silent: boolean) => {
    const lineStart = state.bMarks[startLine] + state.tShift[startLine]
    const lineEnd   = state.eMarks[startLine]
    const line      = state.src.slice(lineStart, lineEnd)

    if (!line.startsWith('$$')) return false
    if (silent) return true

    const afterOpener = line.slice(2).trim()

    // Single-line: $$latex$$
    if (afterOpener.endsWith('$$') && afterOpener.length > 2) {
      const latex = afterOpener.slice(0, -2).trim()
      const token = state.push('math_block', 'div', 0)
      token.content = latex
      token.map     = [startLine, startLine + 1]
      state.line    = startLine + 1
      return true
    }

    // Multi-line: $$\n...content...\n$$
    let nextLine = startLine + 1
    let found    = false
    let content  = afterOpener

    while (nextLine < endLine) {
      const ls = state.bMarks[nextLine] + state.tShift[nextLine]
      const le = state.eMarks[nextLine]
      const lc = state.src.slice(ls, le).trim()
      if (lc === '$$') { found = true; break }
      if (content) content += '\n'
      content += state.src.slice(ls, le)
      nextLine++
    }

    state.line = nextLine + (found ? 1 : 0)
    const token = state.push('math_block', 'div', 0)
    token.content = content.trim()
    token.map     = [startLine, state.line]
    return true
  }, { alt: [] })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.renderer.rules.math_block = (tokens: any[], idx: number) =>
    `<div data-math-display="${escapeAttr(tokens[idx].content)}"></div>`

  // ── Inline math: $...$ ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.inline.ruler.before('escape', 'math_inline', (state: any, silent: boolean) => {
    if (state.src[state.pos] !== '$') return false
    if (state.src[state.pos + 1] === '$') return false   // $$: block, skip

    const start = state.pos + 1
    const end   = state.src.indexOf('$', start)
    if (end === -1 || end === start) return false

    const content = state.src.slice(start, end)
    if (content.includes('\n')) return false

    if (!silent) {
      const token   = state.push('math_inline', 'span', 0)
      token.content = content
    }
    state.pos = end + 1
    return true
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.renderer.rules.math_inline = (tokens: any[], idx: number) =>
    `<span data-math-inline="${escapeAttr(tokens[idx].content)}"></span>`
}

// ── MathPopover ──────────────────────────────────────────────────────────────
// Shared by both NodeView click-to-edit and toolbar "Insert equation" button.
// Positions itself below the anchorRef element using fixed coordinates.

interface PopoverProps {
  /** Initial LaTeX value; empty string for a new insertion. */
  latex: string
  displayMode: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onConfirm: (latex: string) => void
  onCancel: () => void
  /** Optional content rendered at the top of the popover (e.g. mode toggle). */
  children?: React.ReactNode
}

export function MathPopover({ latex: initial, displayMode, anchorRef, onConfirm, onCancel, children }: PopoverProps) {
  const [draft, setDraft]   = useState(initial)
  const [pos,   setPos]     = useState<{ top: number; left: number } | null>(null)
  const inputRef            = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    if (initial) inputRef.current?.select()
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => {
    if (!draft.trim()) return ''
    try { return katex.renderToString(draft, { displayMode, throwOnError: false }) }
    catch { return '' }
  }, [draft, displayMode])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onConfirm(draft) }
    if (e.key === 'Escape') onCancel()
  }

  if (!pos) return null

  return createPortal(
    <>
      {/* Invisible backdrop to close on outside click */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onMouseDown={onCancel}
      />
      <div
        style={{
          position: 'fixed',
          top: pos.top, left: pos.left,
          zIndex: 9999,
          background: '#12121E',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '12px 14px',
          minWidth: 280, maxWidth: 420,
          boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        }}
        onMouseDown={(e) => e.stopPropagation()} // keep popover open on self-click
      >
        {children}
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Enter LaTeX…"
          rows={2}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#1A1A2E',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, padding: '7px 10px',
            color: '#E2E8F0', fontSize: 13,
            fontFamily: 'ui-monospace, monospace',
            resize: 'none', outline: 'none',
          }}
        />
        {preview && (
          <div
            dangerouslySetInnerHTML={{ __html: preview }}
            style={{ padding: '6px 2px 2px', color: '#E2E8F0', overflowX: 'auto', minHeight: 28 }}
          />
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
          <button
            onMouseDown={(e) => { e.preventDefault(); onCancel() }}
            style={{ fontSize: 12, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
          >
            Cancel
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); onConfirm(draft) }}
            style={{ fontSize: 12, color: '#818CF8', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 5, cursor: 'pointer', padding: '4px 10px' }}
          >
            {initial ? 'Update ↵' : 'Insert ↵'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── InlineMath NodeView ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InlineMathView({ node, updateAttributes, editor, selected }: any) {
  const [editing, setEditing] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)

  const html = useMemo(() => {
    if (!node.attrs.latex) return '<span style="color:#F87171;font-size:12px">empty</span>'
    try   { return katex.renderToString(node.attrs.latex, { displayMode: false, throwOnError: false }) }
    catch { return `<span style="color:#F87171;font-family:monospace;font-size:12px">${node.attrs.latex}</span>` }
  }, [node.attrs.latex])

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        ref={anchorRef}
        dangerouslySetInnerHTML={{ __html: html }}
        contentEditable={false}
        onClick={() => { if (editor.isEditable) setEditing(true) }}
        style={{
          display: 'inline-block', verticalAlign: 'baseline',
          padding: '0 2px', borderRadius: 3,
          background: selected ? 'rgba(99,102,241,0.15)' : 'transparent',
          outline: selected ? '1px solid rgba(99,102,241,0.4)' : 'none',
          cursor: editor.isEditable ? 'pointer' : 'default',
        }}
      />
      {editing && (
        <MathPopover
          latex={node.attrs.latex as string}
          displayMode={false}
          anchorRef={anchorRef}
          onConfirm={(latex) => { updateAttributes({ latex }); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      )}
    </NodeViewWrapper>
  )
}

// ── BlockMath NodeView ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BlockMathView({ node, updateAttributes, editor, selected }: any) {
  const [editing, setEditing] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)

  const html = useMemo(() => {
    if (!node.attrs.latex) return '<span style="color:#F87171;font-size:12px">empty equation</span>'
    try   { return katex.renderToString(node.attrs.latex, { displayMode: true, throwOnError: false }) }
    catch { return `<span style="color:#F87171;font-family:monospace;font-size:12px">${node.attrs.latex}</span>` }
  }, [node.attrs.latex])

  return (
    <NodeViewWrapper>
      <div
        ref={anchorRef}
        dangerouslySetInnerHTML={{ __html: html }}
        contentEditable={false}
        onClick={() => { if (editor.isEditable) setEditing(true) }}
        style={{
          padding: '12px 16px', borderRadius: 8, margin: '4px 0',
          textAlign: 'center', overflowX: 'auto',
          background: selected ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)',
          border:     selected ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)',
          cursor: editor.isEditable ? 'pointer' : 'default',
        }}
      />
      {editing && (
        <MathPopover
          latex={node.attrs.latex as string}
          displayMode={true}
          anchorRef={anchorRef}
          onConfirm={(latex) => { updateAttributes({ latex }); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      )}
    </NodeViewWrapper>
  )
}

// ── InlineMath extension ──────────────────────────────────────────────────────

export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { latex: { default: '' } }
  },

  parseHTML() {
    return [{
      tag: 'span[data-math-inline]',
      getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute('data-math-inline') ?? '' }),
    }]
  },

  renderHTML({ node }) {
    return ['span', { 'data-math-inline': node.attrs.latex as string }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView as Parameters<typeof ReactNodeViewRenderer>[0])
  },

  addInputRules() {
    // $latex$  →  inlineMath node
    // The regex allows any non-dollar, non-newline content between the $ delimiters.
    return [new InputRule({
      find: /\$([^$\n]+)\$$/,
      handler: ({ state, range, match }) => {
        const latex = match[1]
        const node  = this.type.create({ latex })
        state.tr.replaceWith(range.from, range.to, node).scrollIntoView()
      },
    })]
  },

  addStorage() {
    return {
      markdown: {
        // tiptap-markdown serializer: writes $latex$
        serialize(state: { write: (s: string) => void }, node: { attrs: { latex: string } }) {
          state.write(`$${node.attrs.latex}$`)
        },
        parse: {
          // Configure markdown-it to parse $...$ before each render pass.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setup(md: any) { mathMarkdownPlugin(md) },
        },
      },
    }
  },
})

// ── BlockMath extension ───────────────────────────────────────────────────────

export const BlockMath = Node.create({
  name: 'blockMath',
  group: 'block',
  atom: true,

  addAttributes() {
    return { latex: { default: '' } }
  },

  parseHTML() {
    return [{
      tag: 'div[data-math-display]',
      getAttrs: (el) => ({ latex: (el as HTMLElement).getAttribute('data-math-display') ?? '' }),
    }]
  },

  renderHTML({ node }) {
    return ['div', { 'data-math-display': node.attrs.latex as string }]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView as Parameters<typeof ReactNodeViewRenderer>[0])
  },

  addInputRules() {
    // $$latex$$  on its own paragraph line  →  blockMath node
    return [new InputRule({
      find: /\$\$([^$\n]+)\$\$$/,
      handler: ({ state, range, match }) => {
        const { tr } = state
        const $from  = state.doc.resolve(range.from)
        // Guard: only convert when $$...$$ is the entire paragraph content.
        if ($from.parent.type.name !== 'paragraph') return null
        if ($from.parent.textContent.trim() !== match[0].trim()) return null

        const latex = match[1].trim()
        const node  = this.type.create({ latex })
        tr.replaceWith($from.before(), $from.after(), node).scrollIntoView()
      },
    })]
  },

  addStorage() {
    return {
      markdown: {
        // tiptap-markdown serializer: writes $$\nlatex\n$$
        serialize(
          state: { write: (s: string) => void; ensureNewLine: () => void; closeBlock: (n: unknown) => void },
          node: { attrs: { latex: string } },
        ) {
          state.write(`$$\n${node.attrs.latex}\n$$`)
          state.closeBlock(node)
        },
        parse: {
          // mathMarkdownPlugin is idempotent — calling setup on both extensions
          // is harmless (the .__mathPluginAdded guard prevents double-registration).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setup(md: any) { mathMarkdownPlugin(md) },
        },
      },
    }
  },
})

// ── Toolbar helpers ───────────────────────────────────────────────────────────

/** Insert an inlineMath or blockMath node at the current cursor position. */
export function insertMath(editor: Editor, latex: string, displayMode: boolean) {
  if (displayMode) {
    editor.chain().focus().insertContent({ type: 'blockMath', attrs: { latex } }).run()
  } else {
    editor.chain().focus().insertContent({ type: 'inlineMath', attrs: { latex } }).run()
  }
}
