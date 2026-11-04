'use client'

import { useRef, useState } from 'react'
import { useVaultScene } from '@/components/surgical/use-vault-scene'

const VAULT_PHASES = [
  { n: '01', t: 'Intake, sealed', d: 'Audio and slides enter a closed stack. A WASM core transcribes and aligns them on your device. Nothing is uploaded.' },
  { n: '02', t: 'Pipeline to map', d: 'Extracted terms leave their linear layers and reorganize into concept clusters linked across lectures.' },
  { n: '03', t: 'Red Zone lock', d: 'The highest-confidence cluster is isolated and flagged, so you know what to study first.' },
]

const VAULT_LABELS: [string, string][] = [
  ['AUDIO', 'lecture-14.m4a'],
  ['SLIDES', '38 pp'],
  ['WASM CORE', 'whisper.base.en'],
  ['ALIGN', 'word ↔ slide'],
  ['VAULT', 'AES-GCM 256'],
]

export function EngineSection() {
  const [phase, setPhase] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([])
  const redLabelRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLSpanElement>(null)

  useVaultScene({ sectionRef, hostRef, labelRefs, redLabelRef, railRef }, setPhase)

  return (
    <section ref={sectionRef} id="engine" style={{ position: 'relative', height: '300vh', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="engine-pin" style={{ position: 'sticky', top: 0, overflow: 'hidden', background: '#0A0A0A' }}>
        <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          {VAULT_LABELS.map(([k, val], i) => (
            <div
              key={k}
              data-vlabel
              ref={(el) => { labelRefs.current[i] = el }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                opacity: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 10.5,
                letterSpacing: '0.12em',
                whiteSpace: 'nowrap',
                color: '#76767B',
              }}
            >
              <span style={{ width: 18, height: 1, background: 'rgba(255,255,255,0.28)' }} />
              <span style={{ color: i === 2 ? '#FF3B30' : '#EDEDED' }}>{k}</span>
              <span>{val}</span>
            </div>
          ))}
          <div
            ref={redLabelRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              padding: '8px 10px',
              border: '1px solid rgba(255,59,48,0.5)',
              background: 'rgba(10,10,10,0.85)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              letterSpacing: '0.12em',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: '#FF3B30' }}>RED ZONE · 0.94</span>
            <span style={{ color: '#CFCFD2', letterSpacing: '0.04em' }}>electron transport chain</span>
          </div>
        </div>

        <div
          data-vault-copy
          style={{
            position: 'absolute',
            zIndex: 2,
            left: 'max(clamp(20px,4vw,40px), calc((100% - 1280px) / 2 + clamp(20px,4vw,40px)))',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 'min(380px, calc(100% - 40px))',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30' }}>THE ENGINE</span>
            <h2
              data-vault-h2
              style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontStretch: '82%',
                fontWeight: 600,
                fontSize: 'clamp(34px,3.6vw,52px)',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                textWrap: 'balance',
              }}
            >
              From local vault to knowledge graph.
            </h2>
          </div>
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22, paddingLeft: 22 }}>
            <span style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span
              ref={railRef}
              style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: 1, background: '#FF3B30', transform: 'scaleY(0)', transformOrigin: 'top' }}
            />
            {VAULT_PHASES.map((ph, i) => (
              <div key={ph.n} style={{ display: 'flex', flexDirection: 'column', gap: 8, color: i === phase ? '#EDEDED' : '#5E5E62', transition: 'color .3s' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em' }}>{ph.n}</span>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>{ph.t}</span>
                </div>
                <p
                  data-vault-desc
                  style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: i === phase ? '#9A9A9F' : '#4A4A4E', transition: 'color .3s', textWrap: 'pretty' }}
                >
                  {ph.d}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .engine-pin { height: 100vh; }
        @media (max-width: 767px) {
          @supports (height: 100dvh) {
            .engine-pin { height: 100dvh; }
          }
        }
      `}</style>
    </section>
  )
}
