'use client'

import { useRef } from 'react'
import { useContourField } from '@/components/surgical/use-contour-field'
import { SpecRow } from '@/components/surgical/spec-row'
import { BenchmarkTable } from '@/components/surgical/benchmark-table'
import { XREF_ROWS, KEY_CHAIN, COMPARE_ROWS } from './fixtures'

function xrefCellColor(v: string) {
  if (v === 'peak') return '#FF3B30'
  if (v === '—') return '#5E5E62'
  return '#CFCFD2'
}

export function ArchitectureSection() {
  const xrefCanvasRef = useRef<HTMLCanvasElement>(null)
  const privacyCanvasRef = useRef<HTMLCanvasElement>(null)
  const logCanvasRef = useRef<HTMLCanvasElement>(null)
  useContourField(xrefCanvasRef, { variant: 'card' })
  useContourField(privacyCanvasRef, { variant: 'card' })
  useContourField(logCanvasRef, { variant: 'card' })

  return (
    <section
      id="architecture"
      style={{
        position: 'relative',
        scrollMarginTop: 64,
        padding: 'clamp(88px,10vw,140px) clamp(20px,4vw,40px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'clamp(56px,7vw,96px)' }}>
        {/* Path B + cross-reference card */}
        <div
          data-split
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,0.85fr)',
            gap: 'clamp(40px,6vw,100px)',
            alignItems: 'center',
          }}
        >
          <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.08)', background: '#0C0C0D', overflow: 'hidden' }}>
            <canvas ref={xrefCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(60px)', WebkitBackdropFilter: 'blur(60px)', background: 'rgba(12,12,13,0.5)' }} />
            <div style={{ position: 'relative', padding: 28 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingBottom: 18,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  letterSpacing: '0.14em',
                  color: '#9A9A9F',
                }}
              >
                <span>CROSS-REFERENCE</span>
                <span>BIOL 201 · 3 LECTURES</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1.4fr) repeat(3,minmax(0,0.7fr))',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11.5,
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span style={{ padding: '12px 0', color: '#76767B', letterSpacing: '0.1em' }}>CONCEPT</span>
                <span style={{ padding: '12px 0', color: '#76767B', letterSpacing: '0.1em' }}>L09</span>
                <span style={{ padding: '12px 0', color: '#76767B', letterSpacing: '0.1em' }}>L12</span>
                <span style={{ padding: '12px 0', color: '#76767B', letterSpacing: '0.1em' }}>L14</span>
              </div>
              {XREF_ROWS.map(([name, a, b, c]) => (
                <div
                  key={name}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0,1.4fr) repeat(3,minmax(0,0.7fr))',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    fontSize: 13.5,
                  }}
                >
                  <span style={{ padding: '13px 12px 13px 0', color: '#EDEDED' }}>{name}</span>
                  {[a, b, c].map((v, i) => (
                    <span key={i} style={{ padding: '13px 0', fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.06em', color: xrefCellColor(v) }}>
                      {v}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30' }}>PATH B</span>
            <h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontStretch: '82%',
                fontWeight: 600,
                fontSize: 'clamp(36px,4.6vw,64px)',
                lineHeight: 0.98,
                letterSpacing: '-0.035em',
              }}
            >
              The Deep Knowledge Engine.
            </h2>
            <p style={{ margin: 0, fontSize: 16, color: '#9A9A9F', textWrap: 'pretty' }}>
              For material that doesn&apos;t fit in a list. Every session feeds one infinite
              canvas where concepts link across lectures, so you can trace an idea from the day
              it was introduced to the day it was tested.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
              {[
                ['CANVAS', 'Infinite, zoomable concept map built from your sessions.'],
                ['CROSS-LECTURE', 'The same term in L09 and L14 resolves to one node, with both timestamps.'],
                ['VAULT', 'Zero-knowledge, AES-GCM encrypted. Data never leaves the device.'],
              ].map(([label, value], i) => (
                <div
                  key={label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '140px minmax(0,1fr)',
                    gap: 16,
                    padding: '16px 0',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    borderBottom: i === 2 ? '1px solid rgba(255,255,255,0.08)' : undefined,
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: '#76767B', paddingTop: 2 }}>{label}</span>
                  <span style={{ fontSize: 14.5, color: '#CFCFD2' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Privacy key-chain card */}
        <div
          id="privacy"
          style={{
            scrollMarginTop: 96,
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.08)',
            background: '#0C0C0D',
            overflow: 'hidden',
          }}
        >
          <canvas ref={privacyCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(60px)', WebkitBackdropFilter: 'blur(60px)', background: 'rgba(12,12,13,0.5)' }} />
          <div data-priv-grid style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)' }}>
            <div
              style={{
                padding: 'clamp(28px,4vw,48px)',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                borderRight: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30' }}>PRIVACY</span>
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontStretch: '82%',
                  fontWeight: 600,
                  fontSize: 'clamp(28px,3vw,40px)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.03em',
                }}
              >
                Your data never leaves the device.
              </h3>
              <p style={{ margin: 0, fontSize: 15, color: '#9A9A9F', maxWidth: 400, textWrap: 'pretty' }}>
                Your passphrase derives the key that unlocks everything else, and it is never
                stored or transmitted. There is no password reset and no backdoor.
              </p>
            </div>
            <div style={{ padding: 'clamp(28px,4vw,48px)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
              {KEY_CHAIN.map(([label, value], i) => (
                <SpecRow key={label + i} label={label} value={value} isLast={i === KEY_CHAIN.length - 1} />
              ))}
            </div>
          </div>
        </div>

        {/* Systems log benchmark table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <h3
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontStretch: '82%',
                fontWeight: 600,
                fontSize: 'clamp(28px,3vw,40px)',
                lineHeight: 1.02,
                letterSpacing: '-0.03em',
              }}
            >
              Systems log.
            </h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', color: '#FF3B30' }}>
              NOCTURNE VS. TRADITIONAL TOOLS
            </span>
          </div>
          <div style={{ position: 'relative', border: '1px solid rgba(255,255,255,0.08)', background: '#0C0C0D', overflow: 'hidden' }}>
            <canvas ref={logCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            <div style={{ position: 'absolute', inset: 0, backdropFilter: 'blur(60px)', WebkitBackdropFilter: 'blur(60px)', background: 'rgba(12,12,13,0.62)' }} />
            <div style={{ position: 'relative', overflowX: 'auto' }}>
              <BenchmarkTable
                columns={['OTTER', 'NOTION AI', 'NOCTURNE']}
                rows={COMPARE_ROWS.map(([label, o, no, n], i) => ({ id: 'R' + String(i + 1).padStart(2, '0'), label, values: [o, no, n] }))}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
