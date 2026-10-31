'use client'

import { useState } from 'react'

const FAQ_ITEMS = [
  {
    question: 'Do I need a study guide to start?',
    answer:
      'No. Nocturne generates a Synthetic Study Guide from your slide text alone, so Likely Zone keywords appear before you upload anything else.',
  },
  {
    question: 'Does my audio leave my computer?',
    answer:
      'On the Free tier, never. Whisper runs as a WASM Web Worker directly in your browser — no audio is uploaded. Server-side ASR is opt-in on paid tiers.',
  },
  {
    question: 'What exactly is the Red Zone?',
    answer:
      'The handful of keywords your professor most emphasized — measured by slide dwell time and verbal repetition, then cross-referenced against your study guide and ranked by exam likelihood.',
  },
  {
    question: 'How is my data encrypted?',
    answer:
      'Your passphrase derives a key that wraps a non-extractable Master Key. Files are AES-GCM 256 encrypted in-browser before upload. The server only ever stores opaque blobs.',
  },
  {
    question: 'Is the free tier actually usable?',
    answer:
      'It is the full core product: transcription, Red Zone scoring, heatmaps, and Anki export — capped at 3 sessions per month and 500 MB of storage.',
  },
  {
    question: 'Can I bring my existing Anki deck?',
    answer:
      'Yes. Import any .apkg and your card fronts seed the study guide automatically. Export Red Zone cards back out as a valid, tagged .apkg.',
  },
]

export function FaqSection() {
  const [open, setOpen] = useState<number>(0)

  return (
    <section style={{ padding: 'clamp(72px,9vw,120px) clamp(20px,4vw,40px)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ marginBottom: 44 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30', margin: '0 0 14px' }}>
            QUESTIONS
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontStretch: '82%',
              fontSize: 'clamp(28px,4vw,40px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: 0,
              color: '#EDEDED',
            }}
          >
            Good to know.
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {FAQ_ITEMS.map((q, i) => {
            const isOpen = open === i
            return (
              <div
                key={i}
                style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  borderBottom: i === FAQ_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '18px 0',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 500, color: isOpen ? '#EDEDED' : '#CFCFD2' }}>{q.question}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 16,
                      color: isOpen ? '#FF3B30' : '#76767B',
                      transition: 'color .2s',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                <div
                  style={{
                    maxHeight: isOpen ? 220 : 0,
                    opacity: isOpen ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height .4s cubic-bezier(.16,1,.3,1), opacity .3s',
                  }}
                >
                  <p style={{ margin: 0, padding: '0 0 18px', fontSize: 14, lineHeight: 1.7, color: '#9A9A9F' }}>{q.answer}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
