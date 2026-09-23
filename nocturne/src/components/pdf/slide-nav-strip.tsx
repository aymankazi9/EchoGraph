'use client'

import { Fragment, useEffect, useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useSessionStore } from '@/store/session-store'
import { slideFlash, useMotion } from '@/lib/motion'
import type { SlideEntry } from './pdf-viewer'

// ─── Thumbnail canvas ─────────────────────────────────────────────────────────

function ThumbnailCanvas({ pdfDoc, localPage }: { pdfDoc: PDFDocumentProxy; localPage: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendered = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || rendered.current) return

    // Must live in effect scope so the cleanup closure can set it.
    // Previously it was inside the IntersectionObserver callback, making it
    // unreachable from cleanup — so unmounting while getPage() was awaiting
    // caused "Cannot read properties of null (reading 'sendWithPromise')".
    let cancelled = false

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0]?.isIntersecting || rendered.current || cancelled) return
        rendered.current = true
        observer.disconnect()

        let page: Awaited<ReturnType<typeof pdfDoc.getPage>> | null = null
        try {
          page = await pdfDoc.getPage(localPage)
        } catch {
          // Document was destroyed before the page loaded (e.g. component
          // unmounted while the IntersectionObserver callback was in-flight).
          return
        }
        if (cancelled || !canvasRef.current) { page.cleanup(); return }

        const viewport1 = page.getViewport({ scale: 1.0 })
        const scale = 106 / viewport1.width
        const viewport = page.getViewport({ scale })

        const c = canvasRef.current
        c.width = viewport.width
        c.height = viewport.height
        c.style.width = `${viewport.width}px`
        c.style.height = `${viewport.height}px`

        try {
          await page.render({ canvas: c, viewport }).promise
        } catch {
          // RenderingCancelledException — ignore
        }
        page.cleanup()
      },
      { threshold: 0.1 },
    )

    observer.observe(canvas)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [pdfDoc, localPage])

  return <canvas ref={canvasRef} className="block" />
}

// ─── Strip ────────────────────────────────────────────────────────────────────

interface Props {
  /** Merged global slide list across all files in the session. */
  slides: SlideEntry[]
  currentPage: number
  onPageSelect: (page: number) => void
}

export function SlideNavStrip({ slides, currentPage, onPageSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null)
  // slideZoneMap is keyed by global_slide_index — matches entry.globalIndex directly.
  const slideZoneMap = useSessionStore((s) => s.slideZoneMap)
  const prevSlide = useRef(currentPage)
  const [flashKey, setFlashKey] = useState(0)
  const { reduced } = useMotion()

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentPage])

  useEffect(() => {
    if (prevSlide.current !== currentPage) {
      if (!reduced) setFlashKey((k) => k + 1)
      prevSlide.current = currentPage
    }
  }, [currentPage, reduced])

  const handleClick = useCallback(
    (globalIndex: number) => { onPageSelect(globalIndex) },
    [onPageSelect],
  )

  return (
    <div
      style={{ flex: 1, overflowY: 'auto', padding: '2px 12px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}
      role="listbox"
      aria-label="Slide navigation"
    >
      {slides.map((entry) => {
        const isActive = entry.globalIndex === currentPage
        // Zone lookup uses globalIndex — the correct key in the store map.
        const zone = slideZoneMap[entry.globalIndex]
        const dotColor = zone === 'red' ? '#FB7185' : zone === 'likely' ? '#FBBF24' : null

        return (
          <Fragment key={entry.globalIndex}>
            {/* File boundary label — shown before the first slide of every file after the first */}
            {entry.localPage === 1 && entry.fileIndex > 0 && (
              <div style={{
                padding: '8px 6px 2px',
                fontSize: 9,
                fontFamily: 'var(--font-mono), monospace',
                color: '#3F485C',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                borderTop: '1px solid #16151E',
                marginTop: 4,
                flexShrink: 0,
              }}>
                Slides {entry.fileIndex + 1}
              </div>
            )}

            <button
              ref={isActive ? activeRef : undefined}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => handleClick(entry.globalIndex)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                padding: '6px 6px 5px',
                borderRadius: 8,
                border: `1px solid ${isActive ? '#2D2B45' : 'transparent'}`,
                background: isActive ? '#111119' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              {/* Thumbnail */}
              <div style={{ position: 'relative', width: '100%', background: '#0D0D14', borderRadius: 5, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 66 }}>
                {isActive ? (
                  <motion.div
                    key={flashKey}
                    variants={slideFlash}
                    animate={flashKey > 0 ? 'flash' : false}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ThumbnailCanvas pdfDoc={entry.pdfDoc} localPage={entry.localPage} />
                  </motion.div>
                ) : (
                  <ThumbnailCanvas pdfDoc={entry.pdfDoc} localPage={entry.localPage} />
                )}
                {/* Slide number — bottom-left; shows global index */}
                <span style={{
                  position: 'absolute', bottom: 4, left: 6,
                  fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#94A3B8',
                }}>
                  {String(entry.globalIndex).padStart(2, '0')}
                </span>
                {/* Zone dot — top-right */}
                {dotColor && (
                  <span style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 7, height: 7, borderRadius: '50%', background: dotColor,
                  }} />
                )}
              </div>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
