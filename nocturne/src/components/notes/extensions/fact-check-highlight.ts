// Fact-check highlight decoration for the notes Tiptap editor.
//
// Applies amber underline decorations to matched excerpt strings returned by
// the /api/fact-check endpoint.  The active excerpt (clicked in the side panel)
// gets a background highlight and scrolls into view.
//
// State is managed entirely through ProseMirror transaction meta so there are no
// module-level globals — safe for SSR and multiple instances.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

// ─── Tiptap command type augmentation ────────────────────────────────────────

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    factCheckHighlight: {
      /** Replace the full set of highlighted excerpts and clear the active one. */
      setFactCheckExcerpts:     (excerpts: string[]) => ReturnType
      /** Mark one excerpt as active and scroll the editor to it. */
      setActiveFactCheckExcerpt: (excerpt: string | null) => ReturnType
      /** Remove all fact-check decorations. */
      clearFactCheckHighlights: () => ReturnType
    }
  }
}

// ─── Plugin state ─────────────────────────────────────────────────────────────

interface FCPluginState {
  excerpts:      string[]
  activeExcerpt: string | null
}

export const factCheckHighlightKey = new PluginKey<FCPluginState>('factCheckHighlight')

// ─── Position search ──────────────────────────────────────────────────────────

/**
 * Finds the first occurrence of `excerpt` in the doc and returns its
 * { from, to } in ProseMirror doc coordinates, or null if not found.
 *
 * Builds a flat char→docPos map so matches spanning multiple text nodes work.
 */
function findExcerptPos(
  doc: ProseMirrorNode,
  excerpt: string,
): { from: number; to: number } | null {
  if (!excerpt) return null

  const chars: { docPos: number }[] = []
  let   fullText = ''

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    for (let i = 0; i < node.text.length; i++) {
      chars.push({ docPos: pos + i })
      fullText += node.text[i]
    }
  })

  const idx = fullText.indexOf(excerpt)
  if (idx === -1) return null

  const lastIdx = idx + excerpt.length - 1
  if (!chars[idx] || !chars[lastIdx]) return null

  return { from: chars[idx].docPos, to: chars[lastIdx].docPos + 1 }
}

// ─── Decoration builder ───────────────────────────────────────────────────────

function buildDecorations(
  doc: ProseMirrorNode,
  excerpts: string[],
  activeExcerpt: string | null,
): DecorationSet {
  if (excerpts.length === 0) return DecorationSet.empty

  const decos: Decoration[] = []

  for (const excerpt of excerpts) {
    const pos = findExcerptPos(doc, excerpt)
    if (!pos) continue
    const isActive = excerpt === activeExcerpt
    decos.push(
      Decoration.inline(pos.from, pos.to, {
        class: isActive
          ? 'notes-fc-flag notes-fc-flag-active'
          : 'notes-fc-flag',
      }),
    )
  }

  return DecorationSet.create(doc, decos)
}

// ─── Extension ────────────────────────────────────────────────────────────────

export const FactCheckHighlightExtension = Extension.create({
  name: 'factCheckHighlight',

  addCommands() {
    return {
      setFactCheckExcerpts:
        (excerpts) =>
        ({ tr, dispatch }) => {
          tr.setMeta(factCheckHighlightKey, { excerpts, activeExcerpt: null })
          dispatch?.(tr)
          return true
        },

      setActiveFactCheckExcerpt:
        (excerpt) =>
        ({ tr, dispatch, view, state }) => {
          tr.setMeta(factCheckHighlightKey, { activeExcerpt: excerpt })
          dispatch?.(tr)

          // Scroll to the excerpt in the next frame so the decoration dispatch
          // has flushed before we ask ProseMirror for coordinates.
          if (excerpt && view) {
            const pos = findExcerptPos(state.doc, excerpt)
            if (pos) {
              requestAnimationFrame(() => {
                if (!view.isDestroyed) {
                  const sel = TextSelection.create(view.state.doc, pos.from)
                  view.dispatch(view.state.tr.setSelection(sel).scrollIntoView())
                }
              })
            }
          }
          return true
        },

      clearFactCheckHighlights:
        () =>
        ({ tr, dispatch }) => {
          tr.setMeta(factCheckHighlightKey, { excerpts: [], activeExcerpt: null })
          dispatch?.(tr)
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<FCPluginState>({
        key: factCheckHighlightKey,

        state: {
          init: () => ({ excerpts: [], activeExcerpt: null }),
          apply(tr, old) {
            const meta = tr.getMeta(factCheckHighlightKey) as Partial<FCPluginState> | undefined
            if (!meta) return old
            return { ...old, ...meta }
          },
        },

        props: {
          // Rebuilt fresh on every render — finds excerpts in the current doc
          // so decorations track correctly even after the user edits text.
          decorations(state) {
            const { excerpts, activeExcerpt } = factCheckHighlightKey.getState(state)!
            return buildDecorations(state.doc, excerpts, activeExcerpt)
          },
        },
      }),
    ]
  },
})
