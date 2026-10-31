'use client'

import { useEffect, useRef, useState } from 'react'
import { ConceptGraph } from '@/components/surgical/concept-graph'
import { DEMO_LINES, GRAPH_LAYOUT, GRAPH_EDGES, DEMO_NODE_LABELS, DEMO_NODE_CONFIDENCE } from './fixtures'

const STEPS = [
  { n: '01', l: 'The Drop', d: 'Drag in lecture audio and slides. Nocturne links them.' },
  { n: '02', l: 'The Pipeline', d: 'Local WASM transcription streams confidence scores.' },
  { n: '03', l: 'The Concept Map', d: 'Zoom into the knowledge graph built from the session.' },
]

const demoNodes = GRAPH_LAYOUT.map((n, i) => ({ ...n, label: DEMO_NODE_LABELS[i], confidence: DEMO_NODE_CONFIDENCE[i] }))

export function DemoSection() {
  const [step, setStep] = useState(0)
  const [termCount, setTermCount] = useState(0)
  const [mapZoom, setMapZoom] = useState(false)
  const barRefs = useRef<(HTMLSpanElement | null)[]>([])
  const termScrollRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<Animation | null>(null)
  const hoveringRef = useRef(false)
  const reducedRef = useRef(false)
  const termIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function goStep(i: number) {
    clearInterval(termIntervalRef.current)
    clearTimeout(zoomTimeoutRef.current)
    animRef.current?.cancel()
    const reduced = reducedRef.current

    setStep(i)
    setTermCount(reduced ? DEMO_LINES.length : 0)
    setMapZoom(reduced)

    barRefs.current.forEach((b, j) => { if (b) b.style.transform = j < i ? 'scaleX(1)' : 'scaleX(0)' })

    if (i === 1 && !reduced) {
      termIntervalRef.current = setInterval(() => {
        setTermCount((c) => {
          if (c >= DEMO_LINES.length) { clearInterval(termIntervalRef.current); return c }
          return c + 1
        })
      }, 240)
    }
    if (i === 2 && !reduced) {
      zoomTimeoutRef.current = setTimeout(() => setMapZoom(true), 450)
    }

    const bar = barRefs.current[i]
    if (!bar) return
    if (reduced) { bar.style.transform = 'scaleX(1)'; return }
    const anim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], {
      duration: i === 1 ? 7000 : 6000,
      fill: 'forwards',
      easing: 'linear',
    })
    animRef.current = anim
    if (hoveringRef.current) anim.pause()
    anim.onfinish = () => goStep((i + 1) % 3)
  }

  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    goStep(0)
    return () => {
      clearInterval(termIntervalRef.current)
      clearTimeout(zoomTimeoutRef.current)
      animRef.current?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = termScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [termCount])

  const scored = DEMO_LINES.slice(0, termCount).filter((l) => l.src === 'score')

  return (
    <section
      id="demo"
      style={{
        position: 'relative',
        scrollMarginTop: 64,
        padding: 'clamp(88px,10vw,140px) clamp(20px,4vw,40px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>
        <div data-split style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 40, alignItems: 'end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30' }}>APP BEHAVIOR</span>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontStretch: '82%',
                fontWeight: 600,
                fontSize: 'clamp(34px,4.2vw,56px)',
                lineHeight: 1,
                letterSpacing: '-0.03em',
              }}
            >
              One session, three states.
            </h2>
          </div>
          <p style={{ margin: 0, maxWidth: 460, fontSize: 16, color: '#9A9A9F', textWrap: 'pretty' }}>
            Step through how a single lecture moves from raw files to a ranked Red Zone and a
            navigable concept map. Nothing here touches a server.
          </p>
        </div>

        <div
          onMouseEnter={() => { hoveringRef.current = true; animRef.current?.pause() }}
          onMouseLeave={() => { hoveringRef.current = false; animRef.current?.play() }}
          style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0C0C0D' }}
        >
          <div
            style={{
              height: 40,
              display: 'grid',
              gridTemplateColumns: '80px 1fr 80px',
              alignItems: 'center',
              padding: '0 14px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 8, height: 8, background: 'rgba(255,255,255,0.16)' }} />
              <span style={{ width: 8, height: 8, background: 'rgba(255,255,255,0.16)' }} />
              <span style={{ width: 8, height: 8, background: 'rgba(255,255,255,0.16)' }} />
            </div>
            <div
              style={{
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                color: '#76767B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Nocturne — BIOL 201 / Lecture 14
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: '#76767B' }}>
              OFFLINE
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {STEPS.map((s, i) => (
              <button
                key={s.n}
                type="button"
                onClick={() => goStep(i)}
                style={{
                  position: 'relative',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '20px 22px',
                  border: 'none',
                  borderLeft: i ? '1px solid rgba(255,255,255,0.08)' : 'none',
                  background: i === step ? 'rgba(255,255,255,0.03)' : 'transparent',
                  color: i === step ? '#EDEDED' : '#76767B',
                  cursor: 'pointer',
                  transition: 'background .2s, color .2s',
                }}
              >
                <span style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                <span
                  ref={(el) => { barRefs.current[i] = el }}
                  style={{
                    position: 'absolute',
                    top: -1,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: '#FF3B30',
                    transform: 'scaleX(0)',
                    transformOrigin: 'left',
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em' }}>{s.n}</span>
                <span style={{ fontSize: 15, fontWeight: 500 }}>{s.l}</span>
                <span data-step-desc style={{ fontSize: 12.5, lineHeight: 1.5, color: '#76767B' }}>{s.d}</span>
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', height: 500, overflow: 'hidden' }}>
            {step === 0 && (
              <div data-demo-grid style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
                <div style={{ padding: 32, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex' }}>
                  <div
                    style={{
                      flex: 1,
                      border: '1px dashed rgba(255,255,255,0.18)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 22,
                      padding: 24,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', color: '#76767B' }}>
                      DROP AUDIO + SLIDES
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 1fr auto',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: '#111112',
                          animation: 'noct-in .5s .2s ease both',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            color: '#9A9A9F',
                            border: '1px solid rgba(255,255,255,0.12)',
                            padding: '2px 0',
                            textAlign: 'center',
                          }}
                        >
                          M4A
                        </span>
                        <span style={{ fontSize: 13.5 }}>lecture-14.m4a</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#76767B' }}>48:12</span>
                      </div>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '44px 1fr auto',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          border: '1px solid rgba(255,255,255,0.12)',
                          background: '#111112',
                          animation: 'noct-in .5s .55s ease both',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            letterSpacing: '0.1em',
                            color: '#9A9A9F',
                            border: '1px solid rgba(255,255,255,0.12)',
                            padding: '2px 0',
                            textAlign: 'center',
                          }}
                        >
                          PDF
                        </span>
                        <span style={{ fontSize: 13.5 }}>L14-oxidative-phosphorylation.pdf</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#76767B' }}>38 pp</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.16em', color: '#76767B', paddingBottom: 14 }}>
                    INGEST
                  </span>
                  {[
                    ['Audio', '48:12 · 61.4 MB', '#9A9A9F', '.8s'],
                    ['Slides', '38 extracted', '#9A9A9F', '1s'],
                    ['Study guide', 'optional', '#76767B', '1.2s'],
                    ['Network', 'disabled', '#9A9A9F', '1.4s'],
                  ].map(([label, value, color, delay], i) => (
                    <div
                      key={label}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        padding: '13px 0',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        borderBottom: i === 3 ? '1px solid rgba(255,255,255,0.08)' : undefined,
                        fontSize: 13.5,
                        animation: `noct-in .4s ${delay} ease both`,
                      }}
                    >
                      <span style={{ color: '#9A9A9F' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color }}>{value}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      marginTop: 'auto',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      color: '#EDEDED',
                      animation: 'noct-in .4s 1.7s ease both',
                    }}
                  >
                    LINKED · READY TO RUN
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div data-demo-grid style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)' }}>
                <div
                  ref={termScrollRef}
                  style={{
                    padding: '24px 28px',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                    overflowY: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12.5,
                    lineHeight: 1.95,
                    background: '#0A0A0A',
                  }}
                >
                  {DEMO_LINES.slice(0, termCount).map((ln) => (
                    <div key={ln.ts} style={{ display: 'grid', gridTemplateColumns: '64px 76px minmax(0,1fr) auto', gap: 10, animation: 'noct-in .25s ease both' }}>
                      <span style={{ color: '#5E5E62' }}>{ln.ts}</span>
                      <span style={{ color: '#76767B' }}>[{ln.src}]</span>
                      <span
                        style={{
                          color: ln.red || ln.src === 'done' ? '#EDEDED' : '#9A9A9F',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {ln.msg}
                      </span>
                      <span style={{ color: ln.red ? '#FF3B30' : '#9A9A9F' }}>{ln.val ?? ''}</span>
                    </div>
                  ))}
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 14,
                      background: '#EDEDED',
                      verticalAlign: 'middle',
                      animation: 'noct-blink 1s steps(1) infinite',
                    }}
                  />
                </div>
                <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.16em', color: '#76767B', paddingBottom: 14 }}>
                    CONFIDENCE · LIVE
                  </span>
                  {scored.map((l) => (
                    <div
                      key={l.msg}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        padding: '13px 0',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        animation: 'noct-in .3s ease both',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                        <span>{l.msg}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: l.red ? '#FF3B30' : '#9A9A9F' }}>{l.val}</span>
                      </div>
                      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }}>
                        <div
                          style={{
                            height: 1,
                            width: `${parseFloat(l.val ?? '0') * 100}%`,
                            background: l.red ? '#FF3B30' : '#9A9A9F',
                            transition: 'width .6s',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div data-demo-grid style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }}>
                <div style={{ position: 'relative', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.08)', background: '#0A0A0A' }}>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      transformOrigin: '52% 46%',
                      transform: mapZoom ? 'scale(1.55)' : 'scale(0.92)',
                      transition: 'transform 1.6s cubic-bezier(.22,1,.36,1)',
                      backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
                      backgroundSize: '22px 22px',
                    }}
                  >
                    <ConceptGraph nodes={demoNodes} edges={GRAPH_EDGES} />
                  </div>
                  <div style={{ position: 'absolute', left: 16, bottom: 14, fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.12em', color: '#76767B' }}>
                    {mapZoom ? 'ZOOM 155% · FOCUS NODE' : 'ZOOM 92%'}
                  </div>
                </div>
                <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.16em', color: '#76767B', paddingBottom: 14 }}>
                    INSPECTOR
                  </span>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontStretch: '85%',
                      fontSize: 24,
                      fontWeight: 600,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.15,
                      paddingBottom: 18,
                    }}
                  >
                    electron transport chain
                  </div>
                  {[
                    ['Confidence', '0.94', '#FF3B30'],
                    ['First introduced', 'L09 · 21:40', undefined],
                    ['Peak emphasis', 'L14 · slide 07', undefined],
                    ['Linked concepts', '5', undefined],
                  ].map(([label, value, color], i) => (
                    <div
                      key={label}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto',
                        padding: '12px 0',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        borderBottom: i === 3 ? '1px solid rgba(255,255,255,0.08)' : undefined,
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: '#9A9A9F' }}>{label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: color ?? '#EDEDED' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
