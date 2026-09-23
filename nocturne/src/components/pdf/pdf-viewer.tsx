'use client'

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { motion } from 'framer-motion'
import { getMasterKey } from '@/lib/crypto/vault'
import { fetchAndDecryptFile } from '@/lib/crypto/decrypt'
import { extractSlideText } from '@/lib/pdf/extractor'
import type { SlideSource } from '@/lib/pdf/extractor'
import { createClient } from '@/lib/supabase'
import { useSessionStore } from '@/store/session-store'

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

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number, number, number, number] },
  },
}

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * One entry in the merged global slide list, covering all files in the session.
 * globalIndex is the authoritative key for all per-slide lookups (slideZoneMap, etc.).
 */
export interface SlideEntry {
  /** 1-based cumulative index across all slide files in the session. */
  globalIndex: number
  fileId: string
  /** 0-based index into slideFiles — used for "Slides N" boundary labels. */
  fileIndex: number
  /** 1-based page number within this file's own PDF. */
  localPage: number
  /** Kept alive for the component's lifetime — safe to pass to ThumbnailCanvas. */
  pdfDoc: PDFDocumentProxy
}

export interface PdfViewerHandle {
  goToPage: (page: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SlideFile {
  id: string
  storage_path: string
}

interface Props {
  storagePath: string
  /** UUID of the primary (displayed) PDF file. */
  fileId: string
  /**
   * All slide source files for this session, ordered by session_files.order_index.
   * Defaults to [{ id: fileId, storage_path: storagePath }] for single-source sessions.
   * All files are loaded eagerly and kept alive — thumbnails and navigation
   * work across every file, not just the primary one.
   */
  slideFiles?: SlideFile[]
  sessionId: string
  onSlidesExtracted?: () => void
  /** Called once all slide files are fully loaded. entries covers every slide across every file. */
  onPdfDocReady?: (entries: SlideEntry[], totalPages: number) => void
  onPageChange?: (page: number) => void
}

export const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { storagePath, fileId, slideFiles, sessionId, onSlidesExtracted, onPdfDocReady, onPageChange },
  ref,
) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [loadLabel, setLoadLabel] = useState('Fetching slides…')
  const [loadPct, setLoadPct] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  // currentPage is a global index (1-based, cumulative across all files)
  const [currentPage, setCurrentPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [canvasAreaVersion, setCanvasAreaVersion] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)
  // All loaded documents, kept alive for the session lifetime
  const docsRef = useRef<{ fileId: string; doc: PDFDocumentProxy; url: string }[]>([])
  // globalIndex → SlideEntry for O(1) render lookup
  const entryMapRef = useRef<Map<number, SlideEntry>>(new Map())
  const renderTaskRef = useRef<{ cancel(): void } | null>(null)
  const pageJumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const supabase = createClient()

  const onSlidesExtractedRef = useRef(onSlidesExtracted)
  useEffect(() => { onSlidesExtractedRef.current = onSlidesExtracted }, [onSlidesExtracted])

  const onPdfDocReadyRef = useRef(onPdfDocReady)
  useEffect(() => { onPdfDocReadyRef.current = onPdfDocReady }, [onPdfDocReady])

  const onPageChangeRef = useRef(onPageChange)
  useEffect(() => { onPageChangeRef.current = onPageChange }, [onPageChange])

  // Subscribe to store activeSlideIndex for audio-driven page jumps.
  const activeSlideIndex = useSessionStore((s) => s.activeSlideIndex)

  // ── Expose goToPage imperatively ─────────────────────────────────────────
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) setCurrentPage(page)
    },
    [totalPages],
  )

  useImperativeHandle(ref, () => ({ goToPage }), [goToPage])

  // ── Notify parent when page changes ─────────────────────────────────────
  useEffect(() => {
    onPageChangeRef.current?.(currentPage)
  }, [currentPage])

  // ── Load all slide files on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    // Track everything created in this run so cleanup is complete regardless
    // of whether the load committed before cancellation.
    const pendingDocs: PDFDocumentProxy[] = []
    const allUrls: string[] = []

    async function loadAll() {
      const mk = getMasterKey()
      if (!mk) { setStatus('error'); setError('Vault is locked.'); return }

      const allFiles: SlideFile[] =
        slideFiles && slideFiles.length > 0
          ? slideFiles
          : [{ id: fileId, storage_path: storagePath }]

      const lib = await loadPdfjs()
      const loaded: { fileId: string; doc: PDFDocumentProxy; url: string }[] = []
      const multiFile = allFiles.length > 1

      for (let fi = 0; fi < allFiles.length; fi++) {
        const sf = allFiles[fi]

        const buf = await fetchAndDecryptFile(
          supabase,
          sf.storage_path,
          mk,
          (phase, pct) => {
            if (cancelled) return
            // For multi-file, aggregate: each file contributes 1/N of total progress.
            const withinFile = phase === 'fetch' ? pct * 0.5 : 50 + pct * 0.5
            const overall = ((fi + withinFile / 100) / allFiles.length) * 100
            setLoadLabel(
              multiFile
                ? `Loading slides… (${fi + 1} of ${allFiles.length})`
                : phase === 'fetch' ? 'Fetching slides…' : 'Decrypting slides…',
            )
            setLoadPct(overall)
          },
        )

        if (cancelled) return

        const blob = new Blob([buf], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        allUrls.push(url)

        const doc = await lib.getDocument(url).promise
        if (cancelled) { doc.destroy(); return }

        pendingDocs.push(doc)
        loaded.push({ fileId: sf.id, doc, url })
      }

      // Build the global slide entry list
      const entries: SlideEntry[] = []
      let globalIdx = 0
      for (let fi = 0; fi < loaded.length; fi++) {
        const { fileId: fid, doc } = loaded[fi]
        for (let localPage = 1; localPage <= doc.numPages; localPage++) {
          globalIdx++
          entries.push({ globalIndex: globalIdx, fileId: fid, fileIndex: fi, localPage, pdfDoc: doc })
        }
      }

      // Commit — docs are now owned by docsRef for the component's lifetime
      docsRef.current = loaded
      pendingDocs.length = 0  // committed; cleanup will use docsRef instead
      entryMapRef.current = new Map(entries.map((e) => [e.globalIndex, e]))
      setTotalPages(globalIdx)
      setStatus('ready')
      onPdfDocReadyRef.current?.(entries, globalIdx)
    }

    loadAll().catch((e) => {
      if (!cancelled) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Failed to load PDF.')
      }
    })

    return () => {
      cancelled = true
      // Destroy uncommitted docs (cancelled mid-load before docsRef was set)
      for (const doc of pendingDocs) doc.destroy()
      // Destroy committed docs (deps changed or unmount)
      const committed = docsRef.current
      docsRef.current = []
      entryMapRef.current.clear()
      for (const { doc } of committed) doc.destroy()
      // Revoke all object URLs created in this run
      for (const url of allUrls) URL.revokeObjectURL(url)
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

    // Resolve the correct PDF document and local page from the global index
    const entry = entryMapRef.current.get(currentPage)
    const canvas = canvasRef.current
    const textLayerDiv = textLayerRef.current
    const canvasWrap = canvasWrapRef.current
    const canvasArea = canvasAreaRef.current
    if (!entry || !canvas || !textLayerDiv || !canvasWrap || !canvasArea) return

    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch { /* ignore */ }
      renderTaskRef.current = null
    }

    let cancelled = false

    async function render() {
      const page = await entry!.pdfDoc.getPage(entry!.localPage)
      if (cancelled) { page.cleanup(); return }

      const baseViewport = page.getViewport({ scale: 1.0 })
      const widthScale = (canvasArea!.clientWidth * 0.75) / baseViewport.width
      const heightScale = (canvasArea!.clientHeight * 0.9) / baseViewport.height
      const scale = Math.max(Math.min(widthScale, heightScale), 0.2)
      const viewport = page.getViewport({ scale })

      canvas!.width = viewport.width
      canvas!.height = viewport.height
      canvas!.style.width = `${viewport.width}px`
      canvas!.style.height = `${viewport.height}px`
      canvasWrap!.style.width = `${viewport.width}px`
      canvasWrap!.style.height = `${viewport.height}px`

      const renderTask = page.render({ canvas: canvas!, viewport })
      renderTaskRef.current = renderTask

      try {
        await renderTask.promise
        renderTaskRef.current = null
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
  }, [currentPage, status, canvasAreaVersion])

  // ── Re-render when canvas area resizes ───────────────────────────────────
  useEffect(() => {
    if (status !== 'ready') return
    const el = canvasAreaRef.current
    if (!el) return
    let initial = true
    const ro = new ResizeObserver(() => {
      if (initial) { initial = false; return }
      setCanvasAreaVersion((v) => v + 1)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [status])

  // ── Extract slide text once after load ───────────────────────────────────
  // All files are already loaded and kept alive in docsRef — no need to re-fetch.
  useEffect(() => {
    if (status !== 'ready') return
    const mk = getMasterKey()
    if (!mk) return

    async function maybeExtract() {
      const { count } = await supabase
        .from('slides')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId)

      if ((count ?? 0) > 0) return

      const sources: SlideSource[] = docsRef.current.map((d) => ({ fileId: d.fileId, pdf: d.doc }))
      if (sources.length === 0) return

      await extractSlideText(sources, sessionId, mk!, supabase)
      onSlidesExtractedRef.current?.()
    }

    maybeExtract().catch((e) => console.error('[pdf-viewer] extraction error:', e))
  }, [status, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <div ref={canvasAreaRef} className="flex-1 min-w-0 overflow-auto flex items-center justify-center">
            <div ref={canvasWrapRef} className="relative inline-block">
              <canvas ref={canvasRef} className="block" />
              <div ref={textLayerRef} className="textLayer absolute inset-0" />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
})
