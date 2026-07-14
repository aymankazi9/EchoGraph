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
    <section
      style={{
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div data-reveal="" style={{ marginBottom: 44 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#5B6478',
              margin: '0 0 14px',
            }}
          >
            Questions
          </p>
          <h2
            style={{
              fontSize: 'clamp(28px,4vw,40px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: 0,
              color: '#E2E8F0',
            }}
          >
            Good to know.
          </h2>
        </div>

        <div data-reveal="" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQ_ITEMS.map((q, i) => {
            const isOpen = open === i
            return (
              <div
                key={i}
                style={{
                  border: '1px solid #1E1E2E',
                  borderRadius: 10,
                  background: '#111118',
                  overflow: 'hidden',
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
                    padding: '18px 20px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#E2E8F0' }}>
                    {q.question}
                  </span>
                  <span
                    style={{
                      fontSize: 20,
                      color: isOpen ? '#818CF8' : '#5B6478',
                      transform: isOpen ? 'rotate(45deg)' : 'none',
                      transition: 'transform .3s, color .2s',
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    +
                  </span>
                </button>

                <div
                  style={{
                    maxHeight: isOpen ? 220 : 0,
                    opacity: isOpen ? 1 : 0,
                    overflow: 'hidden',
                    transition:
                      'max-height .4s cubic-bezier(.16,1,.3,1), opacity .3s',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      padding: '0 20px 18px',
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: '#94A3B8',
                    }}
                  >
                    {q.answer}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
