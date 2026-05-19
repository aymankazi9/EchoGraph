'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useSessionStore } from '@/store/session-store'

// Density score → border color per DESIGN_SYSTEM.md §6 PDF nav strip rules.
function densityBorderClass(density: number): string {
  if (density >= 70) return 'border-red-200'
  if (density >= 30) return 'border-amber-200'
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

  // Scroll the active thumbnail into view when currentPage changes.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentPage])

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
                ? 'border-teal-300 bg-bg-subtle'
                : `${densityBorderClass(density)} hover:bg-bg-subtle`,
            ].join(' ')}
          >
            <div className="w-[80px] flex items-center justify-center bg-bg-overlay overflow-hidden">
              <ThumbnailCanvas pdfDoc={pdfDoc} pageNum={pageNum} />
            </div>
            <span
              className={[
                'text-caption',
                isActive ? 'text-teal-300' : 'text-text-tertiary',
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
