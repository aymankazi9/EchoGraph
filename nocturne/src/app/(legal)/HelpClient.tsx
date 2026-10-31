'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { EclipseMark } from '@/components/surgical/eclipse-mark'
import { HelpAccordion } from '@/components/surgical/help-accordion'

type FaqItem = { q: string; a: string }
type FaqGroup = { id: string; heading: string; blurb: string; items: FaqItem[] }

const FAQS: FaqGroup[] = [
  {
    id: 'start', heading: 'Getting started', blurb: 'Uploads, sessions, and your first study guide.',
    items: [
      { q: 'How do I create my first session?', a: "After setting up your vault, go to your vault dashboard and click \"New session\". You'll be prompted to upload files — a PDF of your slides, your lecture audio, and optionally a study guide. You can upload any combination and add more files later." },
      { q: 'What file types can I upload?', a: 'PDF files for lecture slides, MP3/WAV/M4A files for audio recordings, and PDF or plain text for study guides. Audio is transcoded to Opus 64kbps in your browser before encryption, which dramatically reduces file size.' },
      { q: 'Do I need to upload all three files at once?', a: "No. Nocturne works with whatever you have. Slides only gives you the PDF viewer and Synthetic Study Guide. Audio only gives you transcription and Likely Zone scoring. The more inputs you provide, the more features unlock — but you're never blocked from starting." },
    ],
  },
  {
    id: 'enc', heading: 'Encryption & security', blurb: 'Your vault, passphrase, and how data is protected.',
    items: [
      { q: 'What is the vault passphrase?', a: "Your vault passphrase is separate from your Google login. It's used to derive an encryption key in your browser via PBKDF2. This key unlocks your Master Key, which encrypts all your files. The passphrase never leaves your device." },
      { q: 'What if I forget my vault passphrase?', a: 'Use your Recovery Kit — a file you downloaded at signup. It contains a backup of your Master Key. If you lose both your passphrase and your Recovery Kit, your data is permanently unrecoverable. There is no password reset by design.' },
      { q: 'Where is my data stored?', a: "Encrypted file blobs are stored in Supabase Storage. Nocturne servers see only opaque encrypted data — they cannot decrypt it. Your passphrase and Master Key exist only in your browser memory while your vault is open." },
    ],
  },
  {
    id: 'feat', heading: 'Features', blurb: 'Red Zone, Likely Zone, Anki import, transcription.',
    items: [
      { q: 'What is the Red Zone?', a: "Red Zone (shown in red) marks content that appears in your study guide AND was emphasized in your lecture — measured by how long your professor dwelled on each slide and how often they repeated key terms. It's the intersection of \"you need to know this\" and \"your professor stressed this\"." },
      { q: 'What is the Likely Zone?', a: "Likely Zone (shown in purple) is Nocturne's synthetic estimate when you haven't uploaded a study guide. It uses TF-IDF and professor dwell time to infer what's likely important. It upgrades automatically to Red Zone when you add a real study guide." },
      { q: 'How does the Anki import work?', a: 'Nocturne parses the SQLite database inside an .apkg file and extracts card fronts as your keyword list. This seeds the Study Guide automatically — all Red Zone scoring and heatmaps activate immediately based on your existing Anki deck.' },
      { q: 'How accurate is browser transcription?', a: 'Nocturne uses Whisper-base running in WebAssembly in your browser. It handles STEM vocabulary reasonably well but can struggle with dense notation, equations spoken aloud, or heavy accents. Scholar tier adds VibeVoice-ASR (9B param) with hotword injection from your study guide for significantly higher accuracy.' },
    ],
  },
  {
    id: 'trouble', heading: 'Troubleshooting', blurb: 'Slow transcription, failed uploads, blank slides.',
    items: [
      { q: 'Transcription is very slow — is that normal?', a: 'Yes, on the first session. Whisper runs locally in your browser as a WebAssembly model (~140 MB download). After the first download it\'s cached and subsequent sessions are faster. A 60-minute lecture typically takes 5–15 minutes to transcribe in the browser, depending on your hardware.' },
      { q: 'My upload failed partway through — do I need to start over?', a: "No. Nocturne uses a local write-ahead buffer (IndexedDB) so partial uploads can resume. If your upload fails, reopen the session and the upload panel will show the failed files — you can retry without re-selecting them." },
      { q: 'The PDF viewer shows blank slides — why?', a: "PDF.js needs the file to be decrypted first. Make sure your vault is unlocked (you've entered your passphrase). If slides are still blank, the PDF may use fonts or rendering features that PDF.js doesn't support — try exporting a flattened PDF from your slide software." },
    ],
  },
]

const TOTAL_ARTICLES = FAQS.reduce((n, g) => n + g.items.length, 0)

const TICKET_CATS = [
  { id: 'broken', label: 'Something is broken' },
  { id: 'vault', label: 'Vault / encryption' },
  { id: 'billing', label: 'Account & billing' },
  { id: 'feature', label: 'Feature request' },
  { id: 'other', label: 'Other' },
]

function splitHL(text: string, q: string): { before: string; match: string; after: string; hasMatch: boolean } {
  if (!q) return { before: text, match: '', after: '', hasMatch: false }
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return { before: text, match: '', after: '', hasMatch: false }
  return { before: text.slice(0, i), match: text.slice(i, i + q.length), after: text.slice(i + q.length), hasMatch: true }
}

export function HelpClient() {
  const ticketRef = useRef<HTMLElement>(null)
  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const [tCat, setTCat] = useState('broken')
  const [tSubject, setTSubject] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [tEmail, setTEmail] = useState('')
  const [diag, setDiag] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [ticketId, setTicketId] = useState('')
  const [errors, setErrors] = useState<{ subject?: boolean; desc?: boolean; email?: boolean }>({})

  const q = query.trim()
  const ql = q.toLowerCase()

  const groups = FAQS
    .filter((c) => activeCat === 'all' || c.id === activeCat)
    .map((c) => ({
      heading: c.heading,
      id: c.id,
      items: c.items
        .filter((it) => !q || it.q.toLowerCase().includes(ql) || it.a.toLowerCase().includes(ql))
        .map((it, i) => {
          const id = `${c.id}-${i}`
          const isOpen = q ? true : !!open[id]
          const hl = splitHL(it.q, q)
          return { ...hl, a: it.a, id, isOpen }
        }),
    }))
    .filter((g) => g.items.length > 0)

  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const hasResults = total > 0
  const docsTitle = q ? 'Search results' : activeCat === 'all' ? 'Browse the documentation' : (FAQS.find((c) => c.id === activeCat)?.heading ?? '')
  const resultLabel = q ? `${total} result${total === 1 ? '' : 's'} for "${q}"` : `${total} article${total === 1 ? '' : 's'}`

  function toggleItem(id: string) {
    setOpen((o) => ({ ...o, [id]: !o[id] }))
  }

  function toggleCat(id: string) {
    setActiveCat((c) => c === id ? 'all' : id)
    setQuery('')
  }

  function goToTicket() {
    const el = ticketRef.current
    if (!el) return
    const y = el.getBoundingClientRect().top + (document.documentElement.scrollTop || window.scrollY) - 70
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  function validEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) }

  function submit() {
    const errs: typeof errors = {}
    if (!tSubject.trim()) errs.subject = true
    if (!tDesc.trim()) errs.desc = true
    if (!validEmail(tEmail)) errs.email = true
    if (Object.keys(errs).length) { setErrors(errs); return }
    const id = 'NOC-' + Math.floor(10000 + Math.random() * 90000)
    setSubmittedEmail(tEmail.trim())
    setTicketId(id)
    setSubmitted(true)
    setErrors({})
  }

  function resetTicket() {
    setSubmitted(false)
    setTSubject('')
    setTDesc('')
    setTEmail('')
    setTCat('broken')
    setDiag(true)
    setTicketId('')
    setSubmittedEmail('')
    setErrors({})
  }

  const fieldBase: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', transition: 'border-color .2s', borderRadius: 2 }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-base)', fontFamily: 'var(--font-sans)', color: 'var(--color-text-primary)', fontSize: 15, lineHeight: 1.6 }}>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, height: 56, borderBottom: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', background: 'var(--color-bg-base)', zIndex: 20 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <EclipseMark size={20} />
          <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--color-text-primary)' }}>NOCTURNE</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginLeft: 2 }}>/ HELP</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Link href="/" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Home</Link>
          <Link href="/privacy" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: 'var(--color-text-secondary)', textDecoration: 'none' }}>Legal</Link>
          <Link href="/login" style={{ height: 34, padding: '0 16px', display: 'inline-flex', alignItems: 'center', borderRadius: 2, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', textDecoration: 'none' }}>Sign in</Link>
        </nav>
      </header>

      <div>

        {/* Hero + search */}
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px 8px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-tertiary)', marginBottom: 18 }}>Help Center</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4vw,44px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.08, margin: 0, color: 'var(--color-text-primary)' }}>How can we help?</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: '16px auto 30px', maxWidth: 480 }}>Search the documentation, or open a ticket and our team will get back to you within one business day.</p>

          <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}>
            <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }}>
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="6" /><path d="M14 14 L18 18" /></svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder={`SEARCH ${TOTAL_ARTICLES} ARTICLES`}
              style={{ width: '100%', height: 52, padding: '0 46px 0 48px', boxSizing: 'border-box', borderRadius: 2, background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', fontSize: 14.5, outline: 'none', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer' }}
              >
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4 L14 14 M14 4 L4 14" /></svg>
              </button>
            )}
          </div>
        </section>

        {/* Category rows (editorial, not icon cards) */}
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 0' }}>
          <div style={{ borderTop: '1px solid var(--color-border-default)' }}>
            {FAQS.map((c, i) => {
              const on = activeCat === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 18, width: '100%', textAlign: 'left',
                    padding: '16px 14px', cursor: 'pointer', border: 'none',
                    borderBottom: '1px solid var(--color-border-default)',
                    background: on ? 'var(--color-bg-subtle)' : 'transparent',
                  }}
                >
                  <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: on ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 500, color: on ? 'var(--color-text-primary)' : 'var(--color-text-primary-soft)' }}>{c.heading}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--color-text-tertiary)', marginTop: 2 }}>{c.blurb}</span>
                  </span>
                  <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{c.items.length} art.</span>
                  <span style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', color: on ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}>→</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Documentation / FAQ */}
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--color-text-primary)', margin: 0 }}>{docsTitle}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-text-tertiary)' }}>{resultLabel}</span>
              {(activeCat !== 'all' || q) && (
                <button
                  type="button"
                  onClick={() => { setActiveCat('all'); setQuery('') }}
                  style={{ fontSize: 13, color: 'var(--color-accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {hasResults ? (
            <div>
              {groups.map((g) => (
                <div key={g.id} style={{ marginBottom: 30 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--color-text-tertiary)', marginBottom: 6 }}>{g.heading}</div>
                  <HelpAccordion items={g.items} onToggle={toggleItem} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '42px 24px', border: '1px dashed var(--color-border-strong)' }}>
              <p style={{ fontSize: 15.5, color: 'var(--color-text-primary)', margin: '0 0 6px', fontWeight: 500 }}>No articles match &ldquo;{query}&rdquo;</p>
              <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 18px' }}>Try a different term, or open a ticket and we&apos;ll help directly.</p>
              <button
                type="button"
                onClick={goToTicket}
                style={{ height: 42, padding: '0 20px', borderRadius: 2, background: 'var(--color-accent)', color: 'var(--color-text-inverse)', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer' }}
              >
                Contact support
              </button>
            </div>
          )}
        </section>

        {/* Contact / Ticket */}
        <section ref={ticketRef} style={{ maxWidth: 920, margin: '0 auto', padding: '72px 24px 0', scrollMarginTop: 80 }}>
          <div data-contact style={{ display: 'grid', gridTemplateColumns: '0.82fr 1.18fr', gap: 40, alignItems: 'start' }}>

            {/* Left: channels */}
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--color-text-primary)', margin: '0 0 10px' }}>Still need help?</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: '0 0 26px' }}>Open a ticket and we&apos;ll reply within one business day. For anything else, reach us directly.</p>
              <div style={{ borderTop: '1px solid var(--color-border-default)' }}>
                <a href="mailto:support@nocturne.app" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 2px', borderBottom: '1px solid var(--color-border-default)', textDecoration: 'none' }}>
                  <span style={{ width: 32, height: 32, flexShrink: 0, border: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3.5" width="14" height="11" rx="1" /><path d="M3 5 L9 9.5 L15 5" /></svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Email support</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>support@nocturne.app</span>
                  </span>
                </a>
                <a href="mailto:security@nocturne.app" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 2px', borderBottom: '1px solid var(--color-border-default)', textDecoration: 'none' }}>
                  <span style={{ width: 32, height: 32, flexShrink: 0, border: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1.6 L15.2 4 V8.6 c0 4-2.7 6.4-6.2 7.8 C5.5 15 2.8 12.6 2.8 8.6 V4 Z" /></svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>Report a security issue</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>security@nocturne.app</span>
                  </span>
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 2px' }}>
                  <span style={{ width: 32, height: 32, flexShrink: 0, border: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 9 H6 L7.5 5 L10.5 13 L12 9 H15.5" /></svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>System status</span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '0.04em', color: 'var(--color-text-tertiary)' }}>ALL SYSTEMS OPERATIONAL</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: ticket form */}
            <div style={{ border: '1px solid var(--color-border-default)', background: 'var(--color-bg-card)', padding: 28 }}>
              {!submitted ? (
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>Submit a ticket</h3>
                  <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', margin: '0 0 22px' }}>Tell us what&apos;s going on and we&apos;ll dig in.</p>

                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', margin: '0 0 9px' }}>What&apos;s this about?</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {TICKET_CATS.map((tc) => {
                      const on = tCat === tc.id
                      return (
                        <button
                          key={tc.id}
                          type="button"
                          onClick={() => setTCat(tc.id)}
                          style={{
                            padding: '7px 13px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                            border: `1px solid ${on ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                            background: on ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'transparent',
                            color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          }}
                        >
                          {tc.label}
                        </button>
                      )
                    })}
                  </div>

                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', margin: '0 0 8px' }}>Subject</label>
                  <input
                    value={tSubject}
                    onChange={(e) => setTSubject(e.target.value)}
                    type="text"
                    placeholder="Brief summary of the issue"
                    style={{ ...fieldBase, height: 44, padding: '0 14px', border: `1px solid ${errors.subject ? 'var(--color-severity)' : 'var(--color-border-default)'}` }}
                  />
                  {errors.subject && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-severity)', margin: '7px 0 0' }}>Please add a short subject.</p>}

                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', margin: '18px 0 8px' }}>Description</label>
                  <textarea
                    value={tDesc}
                    onChange={(e) => setTDesc(e.target.value)}
                    placeholder="What happened? What did you expect? Steps to reproduce help us move fast."
                    style={{ ...fieldBase, minHeight: 104, resize: 'vertical', lineHeight: 1.6, border: `1px solid ${errors.desc ? 'var(--color-severity)' : 'var(--color-border-default)'}`, padding: 14 }}
                  />
                  {errors.desc && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-severity)', margin: '7px 0 0' }}>Please describe the issue.</p>}

                  <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', margin: '18px 0 8px' }}>Your email</label>
                  <input
                    value={tEmail}
                    onChange={(e) => setTEmail(e.target.value)}
                    type="email"
                    placeholder="you@university.edu"
                    style={{ ...fieldBase, height: 44, padding: '0 14px', border: `1px solid ${errors.email ? 'var(--color-severity)' : 'var(--color-border-default)'}` }}
                  />
                  {errors.email && <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-severity)', margin: '7px 0 0' }}>Enter a valid email so we can reply.</p>}

                  <button
                    type="button"
                    onClick={() => setDiag((d) => !d)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', marginTop: 20, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1, width: 18, height: 18, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: diag ? 'var(--color-accent)' : 'transparent', border: `1px solid ${diag ? 'var(--color-accent)' : 'var(--color-border-strong)'}`, transition: 'background .2s, border-color .2s' }}>
                      {diag && <svg width="11" height="11" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-inverse)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5 L7.5 13 L14 5" /></svg>}
                    </span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>Attach diagnostic info (app version, browser, last error). <span style={{ color: 'var(--color-text-tertiary)' }}>Never includes your passphrase or decrypted content.</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={submit}
                    style={{ width: '100%', height: 48, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 2, fontSize: 15, fontWeight: 500, background: 'var(--color-accent)', color: 'var(--color-text-inverse)', border: 'none', cursor: 'pointer' }}
                  >
                    Submit ticket <span style={{ fontFamily: 'var(--font-mono)' }}>→</span>
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '14px 4px 6px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, color: 'var(--color-text-primary)', marginBottom: 14 }}>[✓]</div>
                  <h3 style={{ fontSize: 19, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>Ticket created</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: '0 auto 18px', maxWidth: 300 }}>
                    We&apos;ve logged <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{ticketId}</span> and sent a confirmation to <span style={{ color: 'var(--color-text-primary)' }}>{submittedEmail}</span>. Expect a reply within one business day.
                  </p>
                  <button type="button" onClick={resetTicket} style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Submit another ticket</button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ maxWidth: 920, margin: '64px auto 0', padding: '26px 24px 40px', borderTop: '1px solid var(--color-border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)' }}>© 2026 Nocturne Labs, Inc.</span>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <Link href="/" style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>Home</Link>
            <Link href="/privacy" style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>Terms</Link>
            <Link href="/security" style={{ fontSize: 12.5, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>Security</Link>
          </div>
        </footer>
      </div>

      <style>{`
        @media (max-width: 860px) {
          [data-contact] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
