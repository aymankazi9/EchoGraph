'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { AnimatePresence, motion } from 'framer-motion'
import { getMasterKey } from '@/lib/crypto/vault'
import { fetchAndDecryptFile } from '@/lib/crypto/decrypt'
import { extractSlideText } from '@/lib/pdf/extractor'
import { createClient } from '@/lib/supabase'
import { useSessionStore } from '@/store/session-store'
import { PageControls } from './page-controls'
import { SlideNavStrip } from './slide-nav-strip'

// ─── PDF.js lazy loader ───────────────────────────────────────────────────────

let pdfjsLib: typeof import('pdfjs-dist') | null = null

async function loadPdfjs() {
  if (pdfjsLib) return pdfjsLib
  const lib = await import('pdfjs-dist')
  lib.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`
  pdfjsLib = lib
  return lib
}

// ─── Framer Motion variants ───────────────────────────────────────────────────

// Slide transition: enter from right, exit to left — DESIGN_SYSTEM.md §7 slideJump.
const slideJump = {
  enter: { opacity: 0, x: 12 },
  center: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 600, damping: 35 } },
  exit: { opacity: 0, x: -8, transition: { duration: 0.15 } },
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] },
  },
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  storagePath: string
  sessionId: string
}

export function PdfViewer({ storagePath, sessionId }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadLabel, setLoadLabel] = useState('Fetching slides…')
  const [loadPct, setLoadPct] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const renderTaskRef = useRef<{ cancel(): void } | null>(null)
  const pageJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = createClient()

  // Subscribe to store activeSlideIndex for audio-driven page jumps.
  const activeSlideIndex = useSessionStore((s) => s.activeSlideIndex)

  // ── Load PDF on mount ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      const mk = getMasterKey()
      if (!mk) { setStatus('error'); setError('Vault is locked.'); return }

      try {
        const pdfArrayBuffer = await fetchAndDecryptFile(
          supabase,
          storagePath,
          mk,
          (phase, pct) => {
            if (cancelled) return
            setLoadLabel(phase === 'fetch' ? 'Fetching slides…' : 'Decrypting slides…')
            setLoadPct(phase === 'fetch' ? pct * 0.5 : 50 + pct * 0.5)
          },
        )

        if (cancelled) return

        const lib = await loadPdfjs()
        const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        objectUrlRef.current = url

        const pdf = await lib.getDocument(url).promise
        if (cancelled) { pdf.destroy(); return }

        pdfRef.current = pdf
        setTotalPages(pdf.numPages)
        setStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setStatus('error')
          setError(e instanceof Error ? e.message : 'Failed to load PDF.')
        }
      }
    }

    load()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [storagePath]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio-driven page jump — debounced 200ms ─────────────────────────────
  useEffect(() => {
    if (activeSlideIndex === 0 || status !== 'ready') return

    if (pageJumpTimerRef.current) clearTimeout(pageJumpTimerRef.current)
    pageJumpTimerRef.current = setTimeout(() => {
      setCurrentPage((prev) => (activeSlideIndex !== prev ? activeSlideIndex : prev))
    }, 200)

    return () => {
      if (pageJumpTimerRef.current) clearTimeout(pageJumpTimerRef.current)
    }
  }, [activeSlideIndex, status])

  // ── Render page ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    const textLayerDiv = textLayerRef.current
    const canvasWrap = canvasWrapRef.current
    const canvasArea = canvasAreaRef.current
    if (!pdf || !canvas || !textLayerDiv || !canvasWrap || !canvasArea) return

    let cancelled = false

    async function render() {
      const page = await pdf!.getPage(currentPage)
      if (cancelled) { page.cleanup(); return }

      const containerWidth = Math.max(canvasArea!.clientWidth - 4, 200)
      const baseViewport = page.getViewport({ scale: 1.0 })
      const scale = containerWidth / baseViewport.width
      const viewport = page.getViewport({ scale })

      canvas!.width = viewport.width
      canvas!.height = viewport.height
      canvas!.style.width = `${viewport.width}px`
      canvas!.style.height = `${viewport.height}px`
      canvasWrap!.style.width = `${viewport.width}px`
      canvasWrap!.style.height = `${viewport.height}px`

      renderTaskRef.current?.cancel()
      const renderTask = page.render({ canvas: canvas!, viewport })
      renderTaskRef.current = renderTask

      try {
        await renderTask.promise
      } catch (e) {
        if ((e as Error).name === 'RenderingCancelledException') return
        throw e
      }

      if (cancelled) { page.cleanup(); return }

      textLayerDiv!.innerHTML = ''
      const textContent = await page.getTextContent()
      if (cancelled) { page.cleanup(); return }

      const lib = pdfjsLib!
      const textLayer = new lib.TextLayer({
        textContentSource: textContent,
        container: textLayerDiv!,
        viewport,
      })
      await textLayer.render()
      page.cleanup()
    }

    render().catch((e) => {
      if (!cancelled) console.error('[pdf-viewer] render error:', e)
    })

    return () => { cancelled = true }
  }, [currentPage, status])

  // ── Extract slide text once after load ───────────────────────────────────
  useEffect(() => {
    if (status !== 'ready' || !pdfRef.current) return
    const mk = getMasterKey()
    if (!mk) return

    async function maybeExtract() {
      const { count } = await supabase
        .from('slides')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)

      if ((count ?? 0) > 0) return
      await extractSlideText(pdfRef.current!, sessionId, mk!, supabase)
    }

    maybeExtract().catch((e) => console.error('[pdf-viewer] extraction error:', e))
  }, [status, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) setCurrentPage(page)
    },
    [totalPages],
  )

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {status === 'loading' && (
        <div className="flex flex-col gap-2 p-4 shrink-0">
          <span className="text-body-sm text-text-secondary">{loadLabel}</span>
          <div className="h-1 w-full bg-bg-subtle rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-400 transition-all duration-200 ease-out rounded-full"
              style={{ width: `${loadPct}%` }}
            />
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-center flex-1 p-4">
          <p className="text-body-sm text-rose-300" role="alert">{error}</p>
        </div>
      )}

      {status === 'ready' && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex flex-1 min-h-0 overflow-hidden"
        >
          {/* Scrollable canvas area — AnimatePresence key=currentPage fires slideJump on page change */}
          <div ref={canvasAreaRef} className="flex-1 min-w-0 overflow-auto p-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentPage}
                variants={slideJump}
                initial="enter"
                animate="center"
                exit="exit"
                className="inline-block"
              >
                <div ref={canvasWrapRef} className="relative inline-block">
                  <canvas ref={canvasRef} className="block" />
                  <div ref={textLayerRef} className="textLayer absolute inset-0" />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <SlideNavStrip
            pdfDoc={pdfRef.current!}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageSelect={goToPage}
          />
        </motion.div>
      )}

      {status === 'ready' && (
        <PageControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}
    </div>
  )
}
