'use client'

// Node detail panel — bottom sheet on mobile, side drawer on desktop. No Sheet/
// Drawer primitive exists anywhere in this codebase (confirmed during planning —
// only centered Dialog/AlertDialog). Built on Radix's raw Dialog primitive
// directly (same import dialog.tsx/alert-dialog.tsx already use) rather than the
// shared centered-modal wrapper, so existing confirmation dialogs are untouched.

import { Dialog as DialogPrimitive } from 'radix-ui'
import { AnimatePresence, motion } from 'framer-motion'
import { useIsMobile } from '@/lib/use-media-query'
import { useMotion } from '@/lib/motion'

export interface DrawerNode {
  id: string
  label: string
  zone: 'red' | 'likely'
  score: number
  /** Empty string means: no real definition exists — show the slide link instead of templated filler. */
  definition: string
  slideIndex: number | null
  flashcardId: string | null
  neighbors: { id: string; label: string }[]
}

interface Props {
  node: DrawerNode | null
  onClose: () => void
  onSelectNeighbor: (id: string) => void
  onGoToSlide: (slideIndex: number) => void
  onGoToFlashcard: (flashcardId: string) => void
}

export function NodeDrawer({ node, onClose, onSelectNeighbor, onGoToSlide, onGoToFlashcard }: Props) {
  const isMobile = useIsMobile()
  const { reduced } = useMotion()

  const hidden = { x: isMobile ? 0 : 420, y: isMobile ? 420 : 0 }

  return (
    <DialogPrimitive.Root open={!!node} onOpenChange={(open) => { if (!open) onClose() }}>
      <AnimatePresence>
        {node && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.15 }}
                style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, var(--color-bg-base) 50%, transparent)', zIndex: 60 }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild aria-describedby={undefined}>
              <motion.div
                initial={reduced ? { opacity: 0 } : hidden}
                animate={reduced ? { opacity: 1 } : { x: 0, y: 0 }}
                exit={reduced ? { opacity: 0 } : hidden}
                transition={{ duration: reduced ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
                style={isMobile ? {
                  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
                  maxHeight: '75vh', overflowY: 'auto',
                  background: 'var(--color-bg-overlay)', borderTop: '1px solid var(--color-border-default)',
                  padding: '20px 20px 28px',
                } : {
                  position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61,
                  width: 380, overflowY: 'auto',
                  background: 'var(--color-bg-overlay)', borderLeft: '1px solid var(--color-border-default)',
                  padding: 24,
                }}
              >
                <DialogPrimitive.Title asChild>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 10px' }}>
                    {node.label}
                  </h2>
                </DialogPrimitive.Title>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '3px 7px',
                    color: node.zone === 'red' ? 'var(--color-severity)' : 'var(--color-text-secondary)',
                    border: `1px solid ${node.zone === 'red' ? 'color-mix(in srgb, var(--color-severity) 45%, transparent)' : 'var(--color-border-strong)'}`,
                  }}>
                    {node.zone === 'red' ? 'Red Zone' : 'Likely'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    {Math.round(node.score * 100)}% confidence
                  </span>
                </div>

                {node.definition ? (
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: '0 0 20px' }}>
                    {node.definition}
                  </p>
                ) : null}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {node.slideIndex != null && (
                    <button
                      type="button"
                      onClick={() => onGoToSlide(node.slideIndex!)}
                      style={{ height: 36, padding: '0 14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)', fontSize: 13, cursor: 'pointer' }}
                    >
                      → Go to slide {node.slideIndex}
                    </button>
                  )}
                  {node.flashcardId && (
                    <button
                      type="button"
                      onClick={() => onGoToFlashcard(node.flashcardId!)}
                      style={{ height: 36, padding: '0 14px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)', color: 'var(--color-text-primary)', fontSize: 13, cursor: 'pointer' }}
                    >
                      → Go to flashcard
                    </button>
                  )}
                </div>

                {node.neighbors.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 10 }}>
                      Related terms
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {node.neighbors.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => onSelectNeighbor(n.id)}
                          style={{ height: 28, padding: '0 10px', border: '1px solid var(--color-border-default)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 12, cursor: 'pointer' }}
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
