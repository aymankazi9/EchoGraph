'use client'

// Study guide upload section for the left pane.
// Accepts PDF upload, plain text paste, or Anki .apkg import.

import { useRef, useState, useCallback } from 'react'
import { BookOpen, Upload } from 'lucide-react'

export type GuideSource = 'pdf' | 'text' | 'anki'

interface Props {
  onGuide(terms: string[], source: GuideSource): void
  isScoring: boolean
}

export function GuideUpload({ onGuide, isScoring }: Props) {
  const [tab, setTab] = useState<'file' | 'paste'>('file')
  const [pasteText, setPasteText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (isScoring) return

      const source: GuideSource = file.name.endsWith('.apkg') ? 'anki' : 'pdf'

      if (source === 'anki') {
        const { extractApkg } = await import('@/lib/study-guide/anki-import')
        const buf = await file.arrayBuffer()
        const terms = await extractApkg(buf)
        onGuide(terms, 'anki')
        return
      }

      // PDF guide
      const { getMasterKey } = await import('@/lib/crypto/vault')
      const mk = getMasterKey()
      if (!mk) return

      // Load PDF.js lazily
      const lib = await import('pdfjs-dist')
      lib.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`

      const buf = await file.arrayBuffer()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
      const pdfDoc = await lib.getDocument(url).promise
      URL.revokeObjectURL(url)

      const { parsePDFGuide } = await import('@/lib/study-guide/parser')
      const terms = await parsePDFGuide(pdfDoc)
      pdfDoc.destroy()
      onGuide(terms, 'pdf')
    },
    [isScoring, onGuide],
  )

  const handlePaste = useCallback(() => {
    if (!pasteText.trim() || isScoring) return
    import('@/lib/study-guide/parser').then(({ parseTextGuide }) => {
      const terms = parseTextGuide(pasteText)
      onGuide(terms, 'pdf')
      setPasteText('')
    })
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
            placeholder="Paste keywords, one per line…"
            rows={4}
            className={[
              'w-full resize-none rounded-input border border-border-default',
              'bg-bg-input text-body text-text-primary px-2 py-1.5',
              'placeholder:text-text-tertiary focus:outline-none focus:border-teal-300',
              'focus:shadow-teal transition-colors text-body-sm',
            ].join(' ')}
          />
          <button
            type="button"
            disabled={!pasteText.trim() || isScoring}
            onClick={handlePaste}
            className={[
              'w-full py-1.5 rounded-btn text-label font-medium',
              'bg-teal-300 text-text-inverse hover:bg-teal-400 transition-colors',
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
