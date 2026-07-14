'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LEGAL_DOCS, type Block, type Doc } from './legalDocs'

function wordsIn(doc: Doc): number {
  let n = 0
  for (const s of doc.sections) {
    n += s.h.split(/\s+/).length
    for (const b of s.blocks) {
      if ('text' in b && b.text) n += b.text.split(/\s+/).length
      if ('items' in b && b.items) for (const it of b.items) n += it.split(/\s+/).length
      if ('can' in b && b.can) for (const it of b.can) n += it.split(/\s+/).length
      if ('cannot' in b && b.cannot) for (const it of b.cannot) n += it.split(/\s+/).length
    }
  }
  return n
}

function BlockRenderer({ block }: { block: Block }) {
  if (block.k === 'text') {
    return <p style={{ fontSize: 15.5, lineHeight: 1.75, color: '#C2CCDA', margin: '0 0 15px' }}>{block.text}</p>
  }
  if (block.k === 'sub') {
    return <div style={{ fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#818CF8', margin: '20px 0 9px' }}>{block.text}</div>
  }
  if (block.k === 'list') {
    return (
      <ul style={{ listStyle: 'none', margin: '2px 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {block.items.map((it, i) => (
          <li key={i} style={{ display: 'flex', gap: 13, fontSize: 15, lineHeight: 1.65, color: '#C2CCDA' }}>
            <span style={{ flexShrink: 0, width: 5, height: 5, borderRadius: '50%', background: '#6366F1', marginTop: 9, boxShadow: '0 0 6px rgba(99,102,241,0.5)' }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (block.k === 'callout-i') {
    return (
      <div style={{ display: 'flex', gap: 13, margin: '8px 0 18px', padding: '16px 18px', borderRadius: 11, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.07)' }}>
        <span style={{ flexShrink: 0, marginTop: 1, color: '#A5B4FC' }}>
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1.6 L15.2 4 V8.6 c0 4-2.7 6.4-6.2 7.8 C5.5 15 2.8 12.6 2.8 8.6 V4 Z" /><path d="M6.4 9 L8.2 10.8 L11.8 6.8" /></svg>
        </span>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: '#C7CEF5', margin: 0 }}>{block.text}</p>
      </div>
    )
  }
  if (block.k === 'callout-r') {
    return (
      <div style={{ display: 'flex', gap: 13, margin: '8px 0 18px', padding: '16px 18px', borderRadius: 11, border: '1px solid rgba(244,63,94,0.32)', background: 'rgba(244,63,94,0.08)' }}>
        <span style={{ flexShrink: 0, marginTop: 1, color: '#FB7185' }}>
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2 L16.5 15.5 H1.5 Z" /><path d="M9 7 v3.5" /><path d="M9 13 v0.01" /></svg>
        </span>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: '#FCA5B5', margin: 0 }}>{block.text}</p>
      </div>
    )
  }
  if (block.k === 'keys') {
    return (
      <div style={{ margin: '8px 0 18px', border: '1px solid #1E1E2E', borderRadius: 12, background: '#0C0C13', padding: '18px 20px' }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.11em', color: '#5B6478', marginBottom: 13 }}>3-Tier key hierarchy</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, lineHeight: 1.55 }}>
          {block.lines.map((ln, i) =>
            ln.arrow ? (
              <div key={i} style={{ paddingLeft: 14, color: '#5B6478', margin: '2px 0' }}>{ln.text}</div>
            ) : (
              <div key={i} style={{ color: '#A5B4FC', margin: '2px 0' }}>
                {ln.text} {ln.note && <span style={{ color: '#5B6478' }}>({ln.note})</span>}
              </div>
            )
          )}
        </div>
      </div>
    )
  }
  if (block.k === 'compare') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '8px 0 18px' }}>
        <div style={{ border: '1px solid #1E1E2E', borderRadius: 12, background: '#0C0C13', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#94A3B8', marginBottom: 13 }}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 9 S4 3.5 9 3.5 16.5 9 16.5 9 14 14.5 9 14.5 1.5 9 1.5 9 Z" /><circle cx="9" cy="9" r="2" /></svg>
            {block.canTitle}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {block.can.map((c, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.5, color: '#94A3B8' }}>
                <span style={{ flexShrink: 0, width: 4, height: 4, borderRadius: '50%', background: '#5B6478', marginTop: 8 }} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, background: 'rgba(99,102,241,0.05)', padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#A5B4FC', marginBottom: 13 }}>
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="#A5B4FC" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="10" height="7" rx="1.5" /><path d="M6 8 V6 a3 3 0 0 1 6 0 v2" /></svg>
            {block.cannotTitle}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {block.cannot.map((c, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.5, color: '#C7CEF5', alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, marginTop: 2, color: '#818CF8' }}>
                  <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 5 L7 13 L4 10" /></svg>
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }
  return null
}

export function LegalClient({ initialDoc }: { initialDoc: string }) {
  const router = useRouter()
  const [activeDoc, setActiveDoc] = useState(initialDoc)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const obsRef = useRef<IntersectionObserver | null>(null)

  const doc = LEGAL_DOCS.find((d) => d.id === activeDoc) ?? LEGAL_DOCS[0]
  const sections = doc.sections.map((s, i) => ({
    ...s,
    num: String(i + 1).padStart(2, '0'),
    domId: `${doc.id}-${i}`,
  }))
  const mins = Math.max(2, Math.round(wordsIn(doc) / 200))

  const setupSpy = useCallback(() => {
    if (obsRef.current) obsRef.current.disconnect()
    const root = mainRef.current
    if (!root) return
    const secs = [...root.querySelectorAll<HTMLElement>('[data-sec]')]
    if (!secs.length) return
    const order = secs.map((s) => s.dataset.sec!)
    const visible = new Set<string>()
    obsRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.sec!
          if (e.isIntersecting) visible.add(id)
          else visible.delete(id)
        }
        const active = order.find((id) => visible.has(id))
        if (active) setActiveSection(active)
      },
      { root, rootMargin: '-12% 0px -72% 0px', threshold: 0 },
    )
    secs.forEach((s) => obsRef.current!.observe(s))
  }, [])

  useEffect(() => {
    setupSpy()
    return () => { obsRef.current?.disconnect() }
  }, [activeDoc, setupSpy])

  function switchDoc(id: string) {
    if (id === activeDoc) return
    setActiveDoc(id)
    setActiveSection(null)
    mainRef.current?.scrollTo({ top: 0 })
    router.replace(`/${id === 'privacy' ? 'privacy' : id === 'terms' ? 'terms' : id === 'cookies' ? 'cookies' : 'security'}`)
  }

  function goTo(domId: string) {
    const root = mainRef.current
    if (!root) return
    const el = root.querySelector<HTMLElement>(`[data-sec="${domId}"]`)
    if (!el) return
    const cRect = root.getBoundingClientRect()
    const eRect = el.getBoundingClientRect()
    root.scrollTo({ top: root.scrollTop + (eRect.top - cRect.top) - 22, behavior: 'smooth' })
  }

  const activeSectionId = activeSection ?? sections[0]?.domId

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#09090F', color: '#E2E8F0', fontFamily: "'Inter',system-ui,sans-serif" }}>

      {/* Header */}
      <header style={{ flexShrink: 0, height: 60, borderBottom: '1px solid #191827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', background: 'rgba(9,9,15,0.82)', backdropFilter: 'blur(10px)', position: 'relative', zIndex: 5 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ width: 27, height: 27, borderRadius: 8, background: 'linear-gradient(145deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#09090F', fontWeight: 700, fontSize: 14, boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 14px rgba(99,102,241,0.32)' }}>N</span>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: '#E2E8F0' }}>Nocturne</span>
          <span style={{ fontSize: 13, color: '#3F485C', marginLeft: 2 }}>/ Legal</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: '#94A3B8', textDecoration: 'none' }}>Home</Link>
          <Link href="/security" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: '#94A3B8', textDecoration: 'none' }}>Security</Link>
          <Link href="/login" style={{ height: 34, padding: '0 16px', display: 'inline-flex', alignItems: 'center', borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#E2E8F0', border: '1px solid #2D2B45', textDecoration: 'none' }}>Sign in</Link>
        </nav>
      </header>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

        {/* Sidebar */}
        <aside data-side style={{ width: 288, flexShrink: 0, borderRight: '1px solid #191827', overflowY: 'auto', padding: '30px 22px 48px' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.13em', color: '#5B6478', margin: '0 0 13px 4px' }}>Legal documents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 30 }}>
            {LEGAL_DOCS.map((d) => {
              const on = d.id === activeDoc
              return (
                <button
                  key={d.id}
                  type="button"
                  data-doctab
                  onClick={() => switchDoc(d.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', border: `1px solid ${on ? 'rgba(99,102,241,0.32)' : 'transparent'}`, background: on ? 'rgba(99,102,241,0.12)' : 'transparent', color: on ? '#C7CEF5' : '#94A3B8' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: on ? '#818CF8' : '#2D2B45', boxShadow: on ? '0 0 8px rgba(129,140,248,0.7)' : 'none' }} />
                  {d.label}
                </button>
              )
            })}
          </div>

          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.13em', color: '#5B6478', margin: '0 0 12px 4px' }}>On this page</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sections.map((s) => {
              const on = s.domId === activeSectionId
              return (
                <button
                  key={s.domId}
                  type="button"
                  data-doctoc
                  onClick={() => goTo(s.domId)}
                  style={{ display: 'flex', gap: 9, alignItems: 'baseline', width: '100%', textAlign: 'left', padding: '6px 0 6px 13px', marginLeft: -1, cursor: 'pointer', background: 'none', borderLeft: `2px solid ${on ? '#6366F1' : '#191827'}`, fontSize: 13, lineHeight: 1.4, color: on ? '#E2E8F0' : '#5B6478' }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, flexShrink: 0, color: on ? '#818CF8' : '#3F485C' }}>{s.num}</span>
                  {s.h}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main scroll column */}
        <main ref={mainRef} style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 260, background: 'radial-gradient(640px 260px at 32% -40px, rgba(99,102,241,0.09) 0%, rgba(139,92,246,0.03) 45%, transparent 72%)', pointerEvents: 'none', zIndex: 0 }} />

          <div data-docbody key={activeDoc} style={{ position: 'relative', zIndex: 1, maxWidth: 768, margin: '0 auto', padding: '46px 44px 84px' }}>

            {/* Mobile doc switcher */}
            <div data-mobswitch style={{ display: 'none', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
              {LEGAL_DOCS.map((d) => {
                const on = d.id === activeDoc
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => switchDoc(d.id)}
                    style={{ padding: '8px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${on ? 'rgba(99,102,241,0.4)' : '#2D2B45'}`, background: on ? 'rgba(99,102,241,0.12)' : 'transparent', color: on ? '#C7CEF5' : '#94A3B8' }}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>

            {/* Doc header */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '5px 13px 5px 11px', borderRadius: 9999, border: '1px solid #2D2B45', background: 'rgba(17,17,24,0.6)', marginBottom: 18 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818CF8', boxShadow: '0 0 8px rgba(129,140,248,0.6)' }} />
              <span style={{ fontSize: 11.5, letterSpacing: '0.05em', color: '#94A3B8' }}>{doc.tag}</span>
            </div>
            <h1 style={{ fontSize: 'clamp(28px,3.2vw,37px)', fontWeight: 600, letterSpacing: '-0.025em', color: '#E2E8F0', margin: '0 0 14px', lineHeight: 1.12 }}>{doc.label}</h1>
            <p style={{ fontSize: 16, lineHeight: 1.62, color: '#94A3B8', margin: '0 0 24px', maxWidth: 580 }}>{doc.subtitle}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingBottom: 28, marginBottom: 8, borderBottom: '1px solid #191827', fontSize: 12.5, color: '#5B6478' }}>
              <span>Effective June 1, 2026</span>
              <span style={{ color: '#2D2B45' }}>•</span>
              <span>Last updated June 1, 2026</span>
              <span style={{ color: '#2D2B45' }}>•</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5 }}>{mins} min read</span>
            </div>

            {/* Sections */}
            {sections.map((s) => (
              <section key={s.domId} data-sec={s.domId} style={{ paddingTop: 30 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 13, marginBottom: 14 }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: '#6366F1', fontWeight: 500, flexShrink: 0 }}>{s.num}</span>
                  <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.012em', color: '#E2E8F0', margin: 0, lineHeight: 1.3 }}>{s.h}</h2>
                </div>
                <div>
                  {s.blocks.map((b, i) => <BlockRenderer key={i} block={b} />)}
                </div>
              </section>
            ))}

            {/* Footer */}
            <div style={{ marginTop: 58, paddingTop: 26, borderTop: '1px solid #191827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: '#5B6478' }}>© 2026 Nocturne Labs, Inc.</span>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {LEGAL_DOCS.map((d) => {
                  const on = d.id === activeDoc
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => switchDoc(d.id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: on ? '#A5B4FC' : '#5B6478' }}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <p style={{ marginTop: 18, fontSize: 11.5, lineHeight: 1.55, color: '#3F485C' }}>This document is a design artifact for the Nocturne product and is not legal advice.</p>
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 940px) {
          [data-side] { display: none !important; }
          [data-mobswitch] { display: flex !important; }
        }
        [data-doctab]:hover { background: rgba(99,102,241,0.06) !important; }
        [data-doctoc]:hover { color: #94A3B8 !important; }
      `}</style>
    </div>
  )
}
