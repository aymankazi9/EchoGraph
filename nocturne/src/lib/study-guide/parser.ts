// Parses study guide content (text or PDF) into a deduplicated keyword list.

import type { PDFDocumentProxy } from 'pdfjs-dist'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Split raw text into candidate keyword phrases (1-4 word spans).
function extractPhrases(raw: string): string[] {
  const terms = new Set<string>()

  // Split on common delimiters: newlines, bullets, semicolons, commas, colons
  const chunks = raw.split(/[\n\r;,:|•\-–—]+/)

  for (const chunk of chunks) {
    // Strip HTML tags, parentheses, brackets, leading numbers
    const clean = chunk
      .replace(/<[^>]+>/g, '')
      .replace(/[()[\]{}]/g, '')
      .replace(/^\s*[\d.]+\s*/, '')
      .trim()
      .toLowerCase()

    if (!clean || clean.length < 3 || clean.length > 80) continue

    // Accept single terms and short multi-word phrases (up to 4 words)
    const wordCount = clean.split(/\s+/).length
    if (wordCount > 0 && wordCount <= 4) {
      terms.add(clean)
    }
  }

  return [...terms]
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Parse a plain-text study guide into a deduplicated keyword list. */
export function parseTextGuide(text: string): string[] {
  return extractPhrases(text)
}

/** Extract all text from a PDF doc and parse it as a study guide. */
export async function parsePDFGuide(pdfDoc: PDFDocumentProxy): Promise<string[]> {
  const pageTexts: string[] = []

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pageTexts.push(pageText)
    page.cleanup()
  }

  return extractPhrases(pageTexts.join('\n'))
}
