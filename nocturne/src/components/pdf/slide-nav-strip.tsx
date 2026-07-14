'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useSessionStore } from '@/store/session-store'
import { slideFlash, useMotion } from '@/lib/motion'

// ─── Thumbnail canvas ─────────────────────────────────────────────────────────

function ThumbnailCanvas({ pdfDoc, pageNum }: { pdfDoc: PDFDocumentProxy; pageNum: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendered = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || rendered.current) return

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries[0]?.isIntersecting || rendered.current) return
        rendered.current = true
        observer.disconnect()

        let cancelled = false
        const page = await pdfDoc.getPage(pageNum)
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

        return () => { cancelled = true }
      },
      { threshold: 0.1 },
    )

    observer.observe(canvas)
    return () => observer.disconnect()
  }, [pdfDoc, pageNum])

  return <canvas ref={canvasRef} className="block" />
}

// ─── Strip ────────────────────────────────────────────────────────────────────

interface Props {
  pdfDoc: PDFDocumentProxy
  totalPages: number
  currentPage: number
  onPageSelect: (page: number) => void
}

export function SlideNavStrip({ pdfDoc, totalPages, currentPage, onPageSelect }: Props) {
  const activeRef = useRef<HTMLButtonElement>(null)
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
    (pageNum: number) => { onPageSelect(pageNum) },
    [onPageSelect],
  )

  return (
    <div
      style={{ flex: 1, overflowY: 'auto', padding: '2px 12px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}
      role="listbox"
      aria-label="Slide navigation"
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
        const isActive = pageNum === currentPage
        const zone = slideZoneMap[pageNum]
        const dotColor = zone === 'red' ? '#FB7185' : zone === 'likely' ? '#FBBF24' : null

        return (
          <button
            key={pageNum}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => handleClick(pageNum)}
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
                  <ThumbnailCanvas pdfDoc={pdfDoc} pageNum={pageNum} />
                </motion.div>
              ) : (
                <ThumbnailCanvas pdfDoc={pdfDoc} pageNum={pageNum} />
              )}
              {/* Slide number — bottom-left */}
              <span style={{
                position: 'absolute', bottom: 4, left: 6,
                fontFamily: 'var(--font-mono), monospace', fontSize: 9, color: '#94A3B8',
              }}>
                {String(pageNum).padStart(2, '0')}
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
        )
      })}
    </div>
  )
}
