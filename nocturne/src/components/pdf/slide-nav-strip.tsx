'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useSessionStore } from '@/store/session-store'
import { slideFlash, useMotion } from '@/lib/motion'

function slideBorderClass(zone: 'likely' | 'red' | null | undefined, density: number): string {
  if (zone === 'red') return 'border-rose-400'
  if (zone === 'likely') return 'border-violet-400'
  if (density >= 70) return 'border-rose-400'
  if (density >= 30) return 'border-amber-300'
  return 'border-border-default'
}

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
        const scale = 80 / viewport1.width
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
  const jumpToSlide = useSessionStore((s) => s.jumpToSlide)
  const slideDensityMap = useSessionStore((s) => s.slideDensityMap)
  const slideZoneMap = useSessionStore((s) => s.slideZoneMap)
  const prevSlide = useRef(currentPage)
  const [flashKey, setFlashKey] = useState(0)
  const { reduced } = useMotion()

  // Scroll the active thumbnail into view when currentPage changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentPage])

  // Trigger flash when active slide changes
  useEffect(() => {
    if (prevSlide.current !== currentPage) {
      if (!reduced) setFlashKey((k) => k + 1)
      prevSlide.current = currentPage
    }
  }, [currentPage, reduced])

  const handleClick = useCallback(
    (pageNum: number) => {
      onPageSelect(pageNum)      // update PDF viewer page immediately
      jumpToSlide(pageNum)       // seek audio to that slide's timestamp (if syncMap loaded)
    },
    [onPageSelect, jumpToSlide],
  )

  return (
    <div
      className="w-[100px] shrink-0 border-l border-border-default overflow-y-auto flex flex-col gap-0"
      role="listbox"
      aria-label="Slide navigation"
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
        const isActive = pageNum === currentPage
        const density = slideDensityMap[pageNum] ?? 0
        const zone = slideZoneMap[pageNum]
        return (
          <button
            key={pageNum}
            ref={isActive ? activeRef : undefined}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => handleClick(pageNum)}
            className={[
              'flex flex-col items-center gap-1 py-2 px-2 shrink-0 transition-colors text-left w-full',
              'border-l-2',
              isActive
                ? 'border-indigo-500 bg-bg-subtle'
                : `${slideBorderClass(zone, density)} hover:bg-bg-subtle`,
            ].join(' ')}
          >
            {isActive ? (
              <motion.div
                key={flashKey}
                variants={slideFlash}
                animate={flashKey > 0 ? 'flash' : false}
                className="w-[80px] flex items-center justify-center bg-bg-overlay overflow-hidden"
              >
                <ThumbnailCanvas pdfDoc={pdfDoc} pageNum={pageNum} />
              </motion.div>
            ) : (
              <div className="w-[80px] flex items-center justify-center bg-bg-overlay overflow-hidden">
                <ThumbnailCanvas pdfDoc={pdfDoc} pageNum={pageNum} />
              </div>
            )}
            <span
              className={[
                'text-caption',
                isActive ? 'text-indigo-400' : 'text-text-tertiary',
              ].join(' ')}
            >
              {pageNum}
            </span>
          </button>
        )
      })}
    </div>
  )
}
