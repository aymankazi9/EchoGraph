'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { EclipseMark } from '@/components/surgical/eclipse-mark'
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

const bullet: React.CSSProperties = {
  flexShrink: 0,
  width: 4,
  height: 4,
  marginTop: 9,
  background: 'var(--color-text-tertiary)',
}

function BlockRenderer({ block }: { block: Block }) {
  if (block.k === 'text') {
    return <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--color-text-secondary)', margin: '0 0 15px' }}>{block.text}</p>
  }
  if (block.k === 'sub') {
    return (
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', margin: '22px 0 10px' }}>
        {block.text}
      </div>
    )
  }
  if (block.k === 'list') {
    return (
      <ul style={{ listStyle: 'none', margin: '2px 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {block.items.map((it, i) => (
          <li key={i} style={{ display: 'flex', gap: 13, fontSize: 15, lineHeight: 1.65, color: 'var(--color-text-secondary)' }}>
            <span style={bullet} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    )
  }
  if (block.k === 'callout-i' || block.k === 'callout-r') {
    const label = block.k === 'callout-i' ? 'NOTE' : 'IMPORTANT'
    return (
      <div style={{ margin: '8px 0 18px', padding: '14px 16px', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-subtle)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', marginBottom: 7 }}>{label}</div>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-secondary)', margin: 0 }}>{block.text}</p>
      </div>
    )
  }
  if (block.k === 'keys') {
    return (
      <div style={{ margin: '8px 0 18px', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', padding: '18px 20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 13 }}>3-tier key hierarchy</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6 }}>
          {block.lines.map((ln, i) =>
            ln.arrow ? (
              <div key={i} style={{ paddingLeft: 14, color: 'var(--color-text-tertiary)', margin: '2px 0' }}>{ln.text}</div>
            ) : (
              <div key={i} style={{ color: 'var(--color-text-primary-soft)', margin: '2px 0' }}>
                {ln.text} {ln.note && <span style={{ color: 'var(--color-text-tertiary)' }}>({ln.note})</span>}
              </div>
            )
          )}
        </div>
      </div>
    )
  }
  if (block.k === 'compare') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, margin: '8px 0 18px', background: 'var(--color-border-subtle)' }}>
        <div style={{ background: 'var(--color-bg-card)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 13 }}>
            {block.canTitle}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {block.can.map((c, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
                <span style={{ ...bullet, marginTop: 7 }} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ background: 'var(--color-bg-card)', padding: '16px 18px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 13 }}>
            {block.cannotTitle}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {block.cannot.map((c, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-text-primary-soft)' }}>
                <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>[×]</span>
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
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-base)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <header style={{ flexShrink: 0, height: 56, borderBottom: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', position: 'relative', zIndex: 5 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <EclipseMark size={20} />
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>NOCTURNE</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginLeft: 2 }}>/ LEGAL</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Home</Link>
          <Link href="/security" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Security</Link>
          <Link href="/login" style={{ height: 34, padding: '0 16px', display: 'inline-flex', alignItems: 'center', borderRadius: 2, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', textDecoration: 'none' }}>Sign in</Link>
        </nav>
      </header>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

        {/* Sidebar */}
        <aside data-side style={{ width: 268, flexShrink: 0, borderRight: '1px solid var(--color-border-default)', overflowY: 'auto', padding: '30px 22px 48px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', margin: '0 0 13px 4px' }}>Legal documents</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 30 }}>
            {LEGAL_DOCS.map((d) => {
              const on = d.id === activeDoc
              return (
                <button
                  key={d.id}
                  type="button"
                  data-doctab
                  onClick={() => switchDoc(d.id)}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left',
                    padding: '9px 12px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
                    borderLeft: `2px solid ${on ? 'var(--color-accent)' : 'transparent'}`,
                    background: on ? 'var(--color-bg-subtle)' : 'transparent',
                    color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--color-text-tertiary)', margin: '0 0 12px 4px' }}>On this page</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sections.map((s) => {
              const on = s.domId === activeSectionId
              return (
                <button
                  key={s.domId}
                  type="button"
                  data-doctoc
                  onClick={() => goTo(s.domId)}
                  style={{
                    display: 'flex', gap: 9, alignItems: 'baseline', width: '100%', textAlign: 'left',
                    padding: '6px 0 6px 13px', marginLeft: -1, cursor: 'pointer', background: 'none',
                    borderLeft: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                    fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em',
                    lineHeight: 1.5, color: on ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                  }}
                >
                  <span style={{ flexShrink: 0, color: on ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>{s.num}</span>
                  {s.h}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main scroll column */}
        <main ref={mainRef} style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative' }}>
          <div data-docbody key={activeDoc} style={{ maxWidth: 720, margin: '0 auto', padding: '46px 44px 84px' }}>

            {/* Mobile doc switcher */}
            <div data-mobswitch style={{ display: 'none', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
              {LEGAL_DOCS.map((d) => {
                const on = d.id === activeDoc
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => switchDoc(d.id)}
                    style={{ padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border-default)'}`, background: on ? 'var(--color-bg-subtle)' : 'transparent', color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
                  >
                    {d.label}
                  </button>
                )
              })}
            </div>

            {/* Doc header */}
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', margin: '0 0 14px', lineHeight: 1.15 }}>{doc.label}</h1>
            <p style={{ fontSize: 16, lineHeight: 1.62, color: 'var(--color-text-secondary)', margin: '0 0 24px', maxWidth: 580 }}>{doc.subtitle}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', paddingBottom: 28, marginBottom: 8, borderBottom: '1px solid var(--color-border-default)', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--color-text-tertiary)' }}>
              <span>Effective June 1, 2026</span>
              <span>·</span>
              <span>Last updated June 1, 2026</span>
              <span>·</span>
              <span>{mins} min read</span>
            </div>

            {/* Sections */}
            {sections.map((s) => (
              <section key={s.domId} data-sec={s.domId} style={{ paddingTop: 34 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 13, marginBottom: 14 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-tertiary)', flexShrink: 0 }}>§ {s.num}</span>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 600, letterSpacing: '-0.012em', color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>{s.h}</h2>
                </div>
                <div>
                  {s.blocks.map((b, i) => <BlockRenderer key={i} block={b} />)}
                </div>
              </section>
            ))}

            {/* Footer */}
            <div style={{ marginTop: 58, paddingTop: 26, borderTop: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>© 2026 Nocturne Labs, Inc.</span>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {LEGAL_DOCS.map((d) => {
                  const on = d.id === activeDoc
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => switchDoc(d.id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: on ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <p style={{ marginTop: 18, fontSize: 11.5, lineHeight: 1.55, color: 'var(--color-text-disabled)' }}>This document is a design artifact for the Nocturne product and is not legal advice.</p>
          </div>
        </main>
      </div>

      <style>{`
        @media (max-width: 940px) {
          [data-side] { display: none !important; }
          [data-mobswitch] { display: flex !important; }
        }
        [data-doctab]:hover { background: var(--color-bg-subtle) !important; }
        [data-doctoc]:hover { color: var(--color-text-primary) !important; }
      `}</style>
    </div>
  )
}
