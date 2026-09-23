// Keyword highlight decoration for the notes Tiptap editor.
//
// Reuses the exact same sliding-window matching logic as transcript-pane.tsx —
// "startsWith" on normalised tokens so partial suffixes still match, multi-word
// keywords are matched contiguously.  Applied as ProseMirror inline decorations
// (not marks) so the document structure is untouched.
//
// Updates reactively: subscribes to useSessionStore so that when keywords load
// or change, a zero-length transaction is dispatched to re-run the plugin state.

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { useSessionStore } from '@/store/session-store'

// ─── Token extraction ─────────────────────────────────────────────────────────

interface TextToken {
  /** Normalised form (lowercase, only a-z 0-9 -) used for matching */
  norm: string
  /** Absolute doc start position (inclusive) */
  from: number
  /** Absolute doc end position (exclusive) */
  to: number
}

const wordRe = /[^\s]+/g

function getTextTokens(doc: ProseMirrorNode): TextToken[] {
  const tokens: TextToken[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    wordRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = wordRe.exec(node.text)) !== null) {
      const raw = m[0]
      const norm = raw.toLowerCase().replace(/[^a-z0-9-]/g, '')
      if (norm.length > 0) {
        tokens.push({ norm, from: pos + m.index, to: pos + m.index + raw.length })
      }
    }
  })
  return tokens
}

// ─── Decoration builder ───────────────────────────────────────────────────────

type Keyword = { id: string; term: string; zone: 'red' | 'likely' }

/**
 * Sliding-window match — identical logic to buildAnnotationMap() in
 * transcript-pane.tsx but operating on character positions instead of word ids.
 */
function buildDecorations(doc: ProseMirrorNode, keywords: Keyword[]): DecorationSet {
  if (keywords.length === 0) return DecorationSet.empty

  const tokens = getTextTokens(doc)
  if (tokens.length === 0) return DecorationSet.empty

  const decos: Decoration[] = []

  for (const kw of keywords) {
    const kwTokens = kw.term.split(/\s+/).map((t) => t.toLowerCase())
    const n = kwTokens.length

    for (let i = 0; i <= tokens.length - n; i++) {
      let match = true
      for (let j = 0; j < n; j++) {
        if (!tokens[i + j].norm.startsWith(kwTokens[j])) { match = false; break }
      }
      if (match) {
        decos.push(
          Decoration.inline(tokens[i].from, tokens[i + n - 1].to, {
            class: kw.zone === 'red' ? 'notes-kw-red' : 'notes-kw-likely',
            'data-keyword-id': kw.id,
          }),
        )
      }
    }
  }

  return DecorationSet.create(doc, decos)
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

const keywordHighlightKey = new PluginKey<DecorationSet>('keywordHighlight')

export const KeywordHighlightExtension = Extension.create({
  name: 'keywordHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: keywordHighlightKey,

        state: {
          init(_, { doc }) {
            return buildDecorations(doc, useSessionStore.getState().keywords)
          },
          apply(tr, old) {
            // Rebuild on any document change OR when the store subscription
            // dispatches a transaction with our meta flag set.
            if (!tr.docChanged && !tr.getMeta(keywordHighlightKey)) return old
            return buildDecorations(tr.doc, useSessionStore.getState().keywords)
          },
        },

        props: {
          decorations(state) {
            return keywordHighlightKey.getState(state)
          },
        },

        // ProseMirror plugin view: subscribe to keyword changes from the store
        // and dispatch a refresh transaction when they change.
        view(editorView) {
          let prevKeywords = useSessionStore.getState().keywords

          const unsubscribe = useSessionStore.subscribe((state) => {
            if (state.keywords !== prevKeywords) {
              prevKeywords = state.keywords
              // Dispatch a no-content transaction that the apply() handler detects
              editorView.dispatch(
                editorView.state.tr.setMeta(keywordHighlightKey, true),
              )
            }
          })

          return {
            destroy() {
              unsubscribe()
            },
          }
        },
      }),
    ]
  },
})
