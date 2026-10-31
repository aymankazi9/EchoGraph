'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useContourField } from '@/components/surgical/use-contour-field'
import { RankedRow } from '@/components/surgical/ranked-row'
import { ConceptGraph } from '@/components/surgical/concept-graph'
import { SUBJECTS, GRAPH_LAYOUT, GRAPH_EDGES } from './fixtures'

// Beta mode: primary CTA scrolls to the beta-request form instead of /setup.
const IS_BETA = process.env.NEXT_PUBLIC_BETA_MODE === 'true'

function pathBtnStyle(on: boolean): React.CSSProperties {
  return {
    position: 'relative',
    textAlign: 'left',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    cursor: 'pointer',
    border: 'none',
    borderTop: '1px solid ' + (on ? '#FF3B30' : 'transparent'),
    marginTop: -1,
    background: on ? 'rgba(255,255,255,0.05)' : 'transparent',
    color: on ? '#EDEDED' : '#76767B',
    transition: 'background .2s, color .2s, border-color .2s',
  }
}

export function HeroSection() {
  const [path, setPath] = useState<'A' | 'B'>('A')
  const [subj, setSubj] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const readoutRef = useRef<HTMLDivElement>(null)
  useContourField(canvasRef, { variant: 'hero', readoutRef })

  const SB = SUBJECTS[subj]
  const KW = SB.kw
  const top = KW[0][1]
  const redCount = KW.filter((k) => k[2] === 'RED').length
  const hc: Record<number, string> = { 0: KW[0][1], 1: KW[2][1], 2: KW[1][1] }
  const heroNodes = GRAPH_LAYOUT.map((n, i) => ({ ...n, label: SB.nodes[i], confidence: hc[i] }))
  const inspectorPath = path === 'A' ? `~/nocturne/${SB.dir}/red_zone.json` : `~/nocturne/${SB.dir.split('/')[0]}/canvas.graph`

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        padding: '150px clamp(20px,4vw,40px) 110px',
        background: '#0A0A0A',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
      <div
        data-fade="hl"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #0A0A0A 0%, rgba(10,10,10,0.7) 38%, rgba(10,10,10,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        data-fade="hb"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 140,
          background: 'linear-gradient(180deg, rgba(10,10,10,0), #0A0A0A)',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={readoutRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 3,
          fontFamily: 'var(--font-mono)',
          fontSize: 10.5,
          letterSpacing: '0.08em',
          color: '#9A9A9F',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity .25s',
        }}
      />

      <div
        data-hero-grid
        style={{
          position: 'relative',
          zIndex: 2,
          width: '100%',
          maxWidth: 1280,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)',
          gap: 'clamp(40px,5vw,80px)',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              color: '#9A9A9F',
            }}
          >
            <span style={{ width: 6, height: 6, background: '#FF3B30' }} />
            RUNS ENTIRELY IN YOUR BROWSER
          </div>

          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontStretch: '82%',
              fontWeight: 600,
              fontSize: 'clamp(46px,6.2vw,92px)',
              lineHeight: 0.95,
              letterSpacing: '-0.035em',
              color: '#EDEDED',
              textWrap: 'balance',
            }}
          >
            Two paths to mastery.
            <br />
            <span style={{ color: '#FF3B30' }}>Zero noise.</span>
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: 540,
              fontSize: 17,
              lineHeight: 1.6,
              color: '#9A9A9F',
              textWrap: 'pretty',
            }}
          >
            Whether you need an automated pipeline to extract the Red Zone or an infinite
            canvas to map complex conceptual structures, Nocturne runs locally, privately, and
            ruthlessly fast.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              maxWidth: 560,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(12,12,13,0.7)',
            }}
          >
            <button type="button" onClick={() => setPath('A')} style={pathBtnStyle(path === 'A')}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.16em' }}>PATH A</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Zero-Effort Pipeline</span>
            </button>
            <button type="button" onClick={() => setPath('B')} style={pathBtnStyle(path === 'B')}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.16em' }}>PATH B</span>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Deep Knowledge Engine</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24 }}>
            {IS_BETA ? (
              <a
                href="#beta-request"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('beta-request')?.scrollIntoView({ behavior: 'smooth' })
                }}
                style={{
                  height: 44,
                  padding: '0 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#FF3B30',
                  color: '#0A0A0A',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background .2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF5147' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
              >
                Request beta access <span style={{ fontFamily: 'var(--font-mono)' }}>→</span>
              </a>
            ) : (
              <Link
                href="/setup"
                style={{
                  height: 44,
                  padding: '0 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#FF3B30',
                  color: '#0A0A0A',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background .2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF5147' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
              >
                Get started <span style={{ fontFamily: 'var(--font-mono)' }}>→</span>
              </Link>
            )}
            <a
              href="#demo"
              style={{ fontSize: 14, color: '#9A9A9F', display: 'inline-flex', gap: 8, alignItems: 'center', transition: 'color .2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#EDEDED' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#9A9A9F' }}
            >
              Watch it run <span style={{ fontFamily: 'var(--font-mono)' }}>→</span>
            </a>
          </div>
        </div>

        <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0C0C0D' }}>
          <div
            style={{
              height: 36,
              display: 'grid',
              gridTemplateColumns: '60px 1fr 60px',
              alignItems: 'center',
              padding: '0 12px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 7, height: 7, background: 'rgba(255,255,255,0.16)' }} />
              <span style={{ width: 7, height: 7, background: 'rgba(255,255,255,0.16)' }} />
              <span style={{ width: 7, height: 7, background: 'rgba(255,255,255,0.16)' }} />
            </div>
            <div
              style={{
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: '#76767B',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {inspectorPath}
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: '#76767B' }}>
              LOCAL
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            {SUBJECTS.map((s, i) => {
              const on = i === subj
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setSubj(i)}
                  style={{
                    position: 'relative',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    minWidth: 0,
                    padding: '10px 14px',
                    border: 'none',
                    borderLeft: i ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    boxShadow: on ? 'inset 0 -1px 0 #FF3B30' : 'none',
                    background: on ? 'rgba(255,255,255,0.04)' : 'transparent',
                    color: on ? '#EDEDED' : '#76767B',
                    cursor: 'pointer',
                    transition: 'background .2s, color .2s',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em' }}>{s.code}</span>
                  <span style={{ fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.topic}</span>
                </button>
              )
            })}
          </div>

          {path === 'A' ? (
            <div key="A" style={{ height: 440, display: 'flex', flexDirection: 'column', animation: 'noct-in .4s ease both' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ padding: '20px 22px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', color: '#76767B' }}>TOP CONFIDENCE</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#FF3B30', marginTop: 6 }}>
                    {top}
                  </div>
                </div>
                <div style={{ padding: '20px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', color: '#76767B' }}>RED ZONE</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, lineHeight: 1.1, letterSpacing: '-0.02em', color: '#EDEDED', marginTop: 6 }}>
                    {redCount}
                    <span style={{ fontSize: 16, color: '#76767B' }}> / {SB.terms} terms</span>
                  </div>
                </div>
              </div>
              <div style={{ padding: '8px 0', flex: 1 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px minmax(0,1fr) 56px 72px',
                    padding: '8px 22px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    color: '#76767B',
                  }}
                >
                  <span>#</span>
                  <span>TERM</span>
                  <span>CONF</span>
                  <span style={{ textAlign: 'right' }}>ZONE</span>
                </div>
                {KW.map(([term, conf, zone], i) => (
                  <RankedRow key={term} rank={String(i + 1).padStart(2, '0')} term={term} confidence={conf} zone={zone} />
                ))}
              </div>
              <div
                style={{
                  padding: '12px 22px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  letterSpacing: '0.1em',
                  color: '#76767B',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span>PROCESSED IN {SB.time}</span>
                <span>0 BYTES UPLOADED</span>
              </div>
            </div>
          ) : (
            <div key="B" style={{ height: 440, display: 'flex', flexDirection: 'column', animation: 'noct-in .4s ease both' }}>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  background: '#0A0A0A',
                  backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                <ConceptGraph nodes={heroNodes} edges={GRAPH_EDGES} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 8, padding: '16px 22px', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                <span style={{ color: '#76767B', letterSpacing: '0.1em' }}>NODE</span>
                <span style={{ color: '#EDEDED' }}>{SB.kw[0][0]}</span>
                <span style={{ color: '#76767B', letterSpacing: '0.1em' }}>CONFIDENCE</span>
                <span style={{ color: '#FF3B30' }}>{top} · RED ZONE</span>
                <span style={{ color: '#76767B', letterSpacing: '0.1em' }}>REFERENCED</span>
                <span style={{ color: '#9A9A9F' }}>{SB.refs}</span>
                <span style={{ color: '#76767B', letterSpacing: '0.1em' }}>EDGES</span>
                <span style={{ color: '#9A9A9F' }}>5 linked concepts</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
