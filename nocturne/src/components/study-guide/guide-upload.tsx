'use client'

// Study guide upload section for the left pane.
// Accepts PDF upload, plain text paste, or Anki .apkg import.
//
// For PDF/text: passes raw text to the parent so the LLM extractor can see
// the full guide content. No client-side phrase parsing.
// For Anki: card fronts are already structured terms — passed directly.

import { useRef, useState, useCallback } from 'react'
import { BookOpen, Upload } from 'lucide-react'

// Discriminated union so SessionClient can route each case correctly.
export type GuidePayload =
  | { type: 'text'; rawText: string }   // PDF or pasted text — LLM will extract terms
  | { type: 'anki'; terms: string[] }   // Anki .apkg — terms already extracted

interface Props {
  onGuide(payload: GuidePayload): void
  isScoring: boolean
}

export function GuideUpload({ onGuide, isScoring }: Props) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (isScoring) return

      // ── Anki .apkg ─────────────────────────────────────────────────────────
      if (file.name.endsWith('.apkg')) {
        const { extractApkg } = await import('@/lib/study-guide/anki-import')
        const buf = await file.arrayBuffer()
        const terms = await extractApkg(buf)
        onGuide({ type: 'anki', terms })
        return
      }

      // ── PDF guide — extract raw text, let LLM do the term extraction ───────
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`

      const buf = await file.arrayBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
      const pdfDoc = await lib.getDocument(url).promise
      URL.revokeObjectURL(url)

      const pages: string[] = []
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
        page.cleanup()
      }
      pdfDoc.destroy()

      onGuide({ type: 'text', rawText: pages.join('\n') })
    },
    [isScoring, onGuide],
  )

  const handlePaste = useCallback(() => {
    if (!pasteText.trim() || isScoring) return
    onGuide({ type: 'text', rawText: pasteText })
    setPasteText('')
  }, [pasteText, isScoring, onGuide])

  return (
    <div className="p-3 border-b border-border-default">
      <div className="flex items-center gap-1.5 mb-2">
        <BookOpen size={14} strokeWidth={1.5} className="text-text-tertiary" />
        <span className="text-caption uppercase tracking-wide text-text-tertiary">
          Study Guide
        </span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 mb-2">
        {(['file', 'paste'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'flex-1 py-1 text-caption rounded-btn transition-colors',
              tab === t
                ? 'bg-bg-subtle text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary',
            ].join(' ')}
          >
            {t === 'file' ? 'Upload / Import' : 'Paste text'}
          </button>
        ))}
      </div>

      {tab === 'file' ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.apkg,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={isScoring}
            onClick={() => fileRef.current?.click()}
            className={[
              'w-full flex items-center justify-center gap-1.5 py-2',
              'border border-dashed border-border-strong rounded-btn',
              'text-label text-text-secondary hover:bg-bg-subtle transition-colors',
              isScoring ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <Upload size={12} strokeWidth={1.5} />
            PDF or Anki .apkg
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste study guide text…"
            rows={4}
            className={[
              'w-full resize-none rounded-input border border-border-default',
              'bg-bg-input text-body text-text-primary px-2 py-1.5',
              'placeholder:text-text-tertiary focus:outline-none focus:border-indigo-500',
              'focus:shadow-teal transition-colors text-body-sm',
            ].join(' ')}
          />
          <button
            type="button"
            disabled={!pasteText.trim() || isScoring}
            onClick={handlePaste}
            className={[
              'w-full py-1.5 rounded-btn text-label font-medium',
              'bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors',
              !pasteText.trim() || isScoring ? 'opacity-40 cursor-not-allowed' : '',
            ].join(' ')}
          >
            Use as guide
          </button>
        </div>
      )}
    </div>
  )
}
