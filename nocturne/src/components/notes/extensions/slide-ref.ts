// Custom Tiptap inline node for [[slide:N]] citations.
//
// Round-trip contract (tiptap-markdown reads extension.storage.markdown):
//   serialize: node → "[[slide:N]]" in the stored markdown string
//   parse:     markdown-it inline rule → <span data-slide-ref="N"> → parseHTML picks it up
//
// Input/paste rules fire when the user types or pastes [[slide:N]], converting
// the raw text into a non-editable chip on the fly.

import { Node, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { SlideRefChip } from '../SlideRefChip'

export interface SlideRefOptions {
  /** Called when the user clicks a slide chip. Argument is global_slide_index. */
  onGoToSlide: (slideIndex: number) => void
}

export const SlideRefExtension = Node.create<SlideRefOptions>({
  name: 'slideRef',

  group: 'inline',
  inline: true,
  atom: true,       // treated as a single unit — cursor skips over it
  selectable: true,
  draggable: false,

  addOptions() {
    return { onGoToSlide: () => {} }
  },

  addAttributes() {
    return {
      slideIndex: {
        default: null,
        parseHTML: (el) => parseInt(el.getAttribute('data-slide-ref') ?? '1', 10),
        renderHTML: (attrs) => ({ 'data-slide-ref': String(attrs.slideIndex) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-slide-ref]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-slide-ref': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SlideRefChip)
  },

  // ── Input / paste rules ────────────────────────────────────────────────────

  addInputRules() {
    return [
      nodeInputRule({
        // Fires when the user finishes typing [[slide:N]] — the $ anchors to cursor
        find: /\[\[slide:(\d+)\]\]$/,
        type: this.type,
        getAttributes: (match) => ({ slideIndex: parseInt(match[1] ?? '1', 10) }),
      }),
    ]
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: /\[\[slide:(\d+)\]\]/g,
        type: this.type,
        getAttributes: (match) => ({ slideIndex: parseInt(match[1] ?? '1', 10) }),
      }),
    ]
  },

  // ── tiptap-markdown round-trip spec ────────────────────────────────────────
  // tiptap-markdown reads extension.storage.markdown for per-extension serialize/parse.
  // Without this, getMarkdown() would write "[slideRef]" and setContent() would not
  // reconstruct the node from the stored markdown string.

  addStorage() {
    return {
      markdown: {
        // Serialize: node → [[slide:N]] in the output markdown string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serialize(state: any, node: any) {
          state.write(`[[slide:${node.attrs.slideIndex}]]`)
        },

        parse: {
          // Add an inline markdown-it rule that tokenises [[slide:N]] → <span data-slide-ref="N">
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setup(md: any) {
            // Inline rule: recognises [[slide:N]] in the source
            md.inline.ruler.push(
              'slide_ref',
              (state: { src: string; pos: number; push: (type: string, tag: string, nesting: number) => { attrSet: (k: string, v: string) => void } }, silent: boolean) => {
                const remaining = state.src.slice(state.pos)
                const match = remaining.match(/^\[\[slide:(\d+)\]\]/)
                if (!match) return false
                if (!silent) {
                  const token = state.push('slide_ref', 'span', 0)
                  token.attrSet('data-slide-ref', match[1] ?? '1')
                }
                state.pos += match[0].length
                return true
              },
            )

            // Renderer rule: token → HTML string that parseHTML() will recognise
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            md.renderer.rules['slide_ref'] = (tokens: any[], idx: number) =>
              `<span data-slide-ref="${String(tokens[idx].attrGet('data-slide-ref') ?? '')}"></span>`
          },
        },
      },
    }
  },
})
