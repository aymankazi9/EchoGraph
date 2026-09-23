'use client'

// React NodeView rendered for [[slide:N]] citation nodes.
// NodeViewWrapper must use as="span" since slideRef is an inline node — a div
// would break the block layout of surrounding paragraphs.

import { NodeViewWrapper } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import type { SlideRefOptions } from './extensions/slide-ref'

export function SlideRefChip({ node, extension }: ReactNodeViewProps) {
  const slideIndex = node.attrs.slideIndex as number
  const { onGoToSlide } = extension.options as SlideRefOptions

  return (
    <NodeViewWrapper as="span" contentEditable={false} style={{ display: 'inline' }}>
      <span
        onClick={() => onGoToSlide(slideIndex)}
        title={`Go to Slide ${slideIndex}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          verticalAlign: 'middle',
          padding: '1px 7px',
          borderRadius: 5,
          fontSize: '0.8em',
          fontWeight: 500,
          lineHeight: '1.6',
          background: 'rgba(99,102,241,0.15)',
          border: '1px solid rgba(99,102,241,0.35)',
          color: '#A5B4FC',
          cursor: 'pointer',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.28)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.6)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)'
          ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.35)'
        }}
      >
        ↗ Slide {slideIndex}
      </span>
    </NodeViewWrapper>
  )
}
