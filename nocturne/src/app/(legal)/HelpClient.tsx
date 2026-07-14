'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

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

const CAT_ICONS: Record<string, React.ReactNode> = {
  start: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="8" /><path d="M8 7 L13 10 L8 13 Z" /></svg>,
  enc:   <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="9" width="11" height="8" rx="1.6" /><path d="M6.8 9 V6.5 a3.2 3.2 0 0 1 6.4 0 V9" /></svg>,
  feat:  <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2.5 L11.8 7.2 L16.5 9 L11.8 10.8 L10 15.5 L8.2 10.8 L3.5 9 L8.2 7.2 Z" /></svg>,
  trouble: <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="3" /><path d="M12.1 7.9 L15 5 M7.9 7.9 L5 5 M12.1 12.1 L15 15 M7.9 12.1 L5 15" /></svg>,
}

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

  const fieldBase: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#13121C', color: '#E2E8F0', fontSize: 14, outline: 'none', transition: 'border-color .2s, background .2s' }

  return (
    <div style={{ minHeight: '100vh', background: '#09090F', position: 'relative', fontFamily: "'Inter',system-ui,sans-serif", color: '#E2E8F0', fontSize: 15, lineHeight: 1.6 }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 420, background: 'radial-gradient(720px 380px at 50% -120px, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.05) 42%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, height: 60, borderBottom: '1px solid #191827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', background: 'rgba(9,9,15,0.82)', backdropFilter: 'blur(10px)', zIndex: 20 }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ width: 27, height: 27, borderRadius: 8, background: 'linear-gradient(145deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#09090F', fontWeight: 700, fontSize: 14, boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 14px rgba(99,102,241,0.32)' }}>N</span>
          <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', color: '#E2E8F0' }}>Nocturne</span>
          <span style={{ fontSize: 13, color: '#3F485C', marginLeft: 2 }}>/ Help</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link href="/" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: '#94A3B8', textDecoration: 'none' }}>Home</Link>
          <Link href="/privacy" data-navlink style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', fontSize: 14, color: '#94A3B8', textDecoration: 'none' }}>Legal</Link>
          <Link href="/login" style={{ height: 34, padding: '0 16px', display: 'inline-flex', alignItems: 'center', borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#E2E8F0', border: '1px solid #2D2B45', textDecoration: 'none' }}>Sign in</Link>
        </nav>
      </header>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Hero + search */}
        <section style={{ maxWidth: 680, margin: '0 auto', padding: '64px 24px 8px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '5px 13px 5px 11px', borderRadius: 9999, border: '1px solid #2D2B45', background: 'rgba(17,17,24,0.6)', marginBottom: 22 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#818CF8', boxShadow: '0 0 8px rgba(129,140,248,0.6)' }} />
            <span style={{ fontSize: 11.5, letterSpacing: '0.05em', color: '#94A3B8' }}>Help Center</span>
          </div>
          <h1 style={{ fontSize: 'clamp(30px,4vw,44px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.08, margin: 0, color: '#E2E8F0' }}>How can we help?</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: '#94A3B8', margin: '16px auto 30px', maxWidth: 480 }}>Search the documentation, or open a ticket and our team will get back to you within one business day.</p>

          <div style={{ position: 'relative', maxWidth: 520, margin: '0 auto' }}>
            <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: '#5B6478', pointerEvents: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="6" /><path d="M14 14 L18 18" /></svg>
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Search articles — try 'passphrase' or 'transcription'"
              style={{ width: '100%', height: 54, padding: '0 48px 0 50px', boxSizing: 'border-box', borderRadius: 13, background: '#13121C', border: '1px solid #2D2B45', color: '#E2E8F0', fontSize: 15.5, outline: 'none', fontFamily: 'inherit' }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 7, background: '#1E1E2E', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4 L14 14 M14 4 L4 14" /></svg>
              </button>
            )}
          </div>
        </section>

        {/* Category cards */}
        <section style={{ maxWidth: 920, margin: '0 auto', padding: '40px 24px 0' }}>
          <div data-cats style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
            {FAQS.map((c) => {
              const on = activeCat === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  data-card
                  onClick={() => toggleCat(c.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', padding: '18px 18px 16px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${on ? 'rgba(99,102,241,0.5)' : '#1E1E2E'}`, background: on ? 'rgba(99,102,241,0.08)' : '#0D0D14', boxShadow: on ? '0 0 0 4px rgba(99,102,241,0.07)' : 'none' }}
                >
                  <span style={{ width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? 'rgba(99,102,241,0.16)' : '#13121C', border: `1px solid ${on ? 'rgba(99,102,241,0.32)' : '#1E1E2E'}`, color: on ? '#A5B4FC' : '#818CF8' }}>
                    {CAT_ICONS[c.id]}
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: '#E2E8F0', marginTop: 14 }}>{c.heading}</span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.5, color: '#94A3B8', marginTop: 5 }}>{c.blurb}</span>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10.5, color: '#5B6478', marginTop: 11 }}>{c.items.length} article{c.items.length === 1 ? '' : 's'}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Documentation / FAQ */}
        <section style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.015em', color: '#E2E8F0', margin: 0 }}>{docsTitle}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#5B6478' }}>{resultLabel}</span>
              {(activeCat !== 'all' || q) && (
                <button
                  type="button"
                  onClick={() => { setActiveCat('all'); setQuery('') }}
                  style={{ fontSize: 13, color: '#A5B4FC', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4 L14 14 M14 4 L4 14" /></svg>
                  Clear
                </button>
              )}
            </div>
          </div>

          {hasResults ? (
            <div>
              {groups.map((g) => (
                <div key={g.id} style={{ marginBottom: 30 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1', boxShadow: '0 0 7px rgba(99,102,241,0.6)' }} />
                    <span style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#818CF8', fontWeight: 600 }}>{g.heading}</span>
                  </div>
                  <div>
                    {g.items.map((it) => (
                      <div key={it.id} style={{ borderBottom: '1px solid #191827' }}>
                        <button
                          type="button"
                          onClick={() => toggleItem(it.id)}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%', textAlign: 'left', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          <span style={{ flex: 1, fontSize: 15.5, fontWeight: 500, lineHeight: 1.5, color: '#CBD5E1' }}>
                            {it.before}
                            {it.hasMatch && <mark style={{ background: 'rgba(99,102,241,0.28)', color: '#C7CEF5', borderRadius: 3, padding: '0 2px' }}>{it.match}</mark>}
                            {it.after}
                          </span>
                          <span style={{ flexShrink: 0, marginTop: 1, color: it.isOpen ? '#A5B4FC' : '#5B6478', transform: it.isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .3s cubic-bezier(.34,1.4,.42,1), color .2s' }}>
                            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 7 L9 11.5 L13.5 7" /></svg>
                          </span>
                        </button>
                        {it.isOpen && (
                          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#94A3B8', margin: '-2px 0 18px', paddingRight: 30 }}>{it.a}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '42px 24px', border: '1px dashed #2D2B45', borderRadius: 14, background: 'rgba(17,17,24,0.4)' }}>
              <div style={{ width: 46, height: 46, margin: '0 auto 16px', borderRadius: 12, background: '#13121C', border: '1px solid #1E1E2E', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B6478' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="6" /><path d="M14 14 L18 18" /></svg>
              </div>
              <p style={{ fontSize: 15.5, color: '#E2E8F0', margin: '0 0 6px', fontWeight: 500 }}>No articles match &ldquo;{query}&rdquo;</p>
              <p style={{ fontSize: 14, color: '#94A3B8', margin: '0 0 18px' }}>Try a different term, or open a ticket and we&apos;ll help directly.</p>
              <button
                type="button"
                onClick={goToTicket}
                data-btn
                style={{ height: 42, padding: '0 20px', borderRadius: 9, background: '#6366F1', color: '#09090F', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(99,102,241,0.3)' }}
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
              <h2 style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: '#E2E8F0', margin: '0 0 10px' }}>Still need help?</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: '#94A3B8', margin: '0 0 26px' }}>Open a ticket and we&apos;ll reply within one business day. For anything else, reach us directly.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <a href="mailto:support@nocturne.app" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 11, border: '1px solid #1E1E2E', background: '#0D0D14', textDecoration: 'none' }}>
                  <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A5B4FC' }}>
                    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3.5" width="14" height="11" rx="2" /><path d="M3 5 L9 9.5 L15 5" /></svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#E2E8F0' }}>Email support</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#5B6478', fontFamily: "'JetBrains Mono',monospace" }}>support@nocturne.app</span>
                  </span>
                </a>
                <a href="mailto:security@nocturne.app" style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 11, border: '1px solid #1E1E2E', background: '#0D0D14', textDecoration: 'none' }}>
                  <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FB7185' }}>
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 1.6 L15.2 4 V8.6 c0 4-2.7 6.4-6.2 7.8 C5.5 15 2.8 12.6 2.8 8.6 V4 Z" /></svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#E2E8F0' }}>Report a security issue</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#5B6478', fontFamily: "'JetBrains Mono',monospace" }}>security@nocturne.app</span>
                  </span>
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px', borderRadius: 11, border: '1px solid #1E1E2E', background: '#0D0D14' }}>
                  <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 9, background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2DD4BF' }}>
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 9 H6 L7.5 5 L10.5 13 L12 9 H15.5" /></svg>
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#E2E8F0' }}>
                      System status
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2DD4BF', boxShadow: '0 0 8px rgba(45,212,191,0.7)' }} />
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: '#5B6478', fontFamily: "'JetBrains Mono',monospace" }}>All systems operational</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Right: ticket form */}
            <div style={{ border: '1px solid #1E1E2E', borderRadius: 16, background: 'linear-gradient(180deg,#111118 0%,#0C0C13 100%)', padding: 28 }}>
              {!submitted ? (
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: '#E2E8F0', margin: '0 0 4px' }}>Submit a ticket</h3>
                  <p style={{ fontSize: 13.5, color: '#94A3B8', margin: '0 0 22px' }}>Tell us what&apos;s going on and we&apos;ll dig in.</p>

                  <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '0 0 9px' }}>What&apos;s this about?</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                    {TICKET_CATS.map((tc) => {
                      const on = tCat === tc.id
                      return (
                        <button
                          key={tc.id}
                          type="button"
                          onClick={() => setTCat(tc.id)}
                          style={{ padding: '8px 14px', borderRadius: 9999, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: `1px solid ${on ? 'rgba(99,102,241,0.5)' : '#2D2B45'}`, background: on ? 'rgba(99,102,241,0.14)' : 'transparent', color: on ? '#C7CEF5' : '#94A3B8' }}
                        >
                          {tc.label}
                        </button>
                      )
                    })}
                  </div>

                  <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '0 0 8px' }}>Subject</label>
                  <input
                    value={tSubject}
                    onChange={(e) => setTSubject(e.target.value)}
                    type="text"
                    placeholder="Brief summary of the issue"
                    style={{ ...fieldBase, height: 44, padding: '0 14px', borderRadius: 9, border: `1px solid ${errors.subject ? 'rgba(244,63,94,0.55)' : '#1E1E2E'}` }}
                  />
                  {errors.subject && <p style={{ fontSize: 12, color: '#FB7185', margin: '7px 0 0' }}>Please add a short subject.</p>}

                  <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '18px 0 8px' }}>Description</label>
                  <textarea
                    value={tDesc}
                    onChange={(e) => setTDesc(e.target.value)}
                    placeholder="What happened? What did you expect? Steps to reproduce help us move fast."
                    style={{ ...fieldBase, minHeight: 104, resize: 'vertical', lineHeight: 1.6, borderRadius: 9, border: `1px solid ${errors.desc ? 'rgba(244,63,94,0.55)' : '#1E1E2E'}`, padding: 14, fontFamily: 'inherit' }}
                  />
                  {errors.desc && <p style={{ fontSize: 12, color: '#FB7185', margin: '7px 0 0' }}>Please describe the issue.</p>}

                  <label style={{ display: 'block', fontSize: 12.5, color: '#94A3B8', margin: '18px 0 8px' }}>Your email</label>
                  <input
                    value={tEmail}
                    onChange={(e) => setTEmail(e.target.value)}
                    type="email"
                    placeholder="you@university.edu"
                    style={{ ...fieldBase, height: 44, padding: '0 14px', borderRadius: 9, border: `1px solid ${errors.email ? 'rgba(244,63,94,0.55)' : '#1E1E2E'}` }}
                  />
                  {errors.email && <p style={{ fontSize: 12, color: '#FB7185', margin: '7px 0 0' }}>Enter a valid email so we can reply.</p>}

                  <button
                    type="button"
                    onClick={() => setDiag((d) => !d)}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', marginTop: 20, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 1, width: 20, height: 20, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: diag ? '#6366F1' : 'transparent', border: `1px solid ${diag ? '#6366F1' : '#2D2B45'}`, transition: 'background .2s, border-color .2s' }}>
                      {diag && <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="#09090F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5 L7.5 13 L14 5" /></svg>}
                    </span>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: '#94A3B8' }}>Attach diagnostic info (app version, browser, last error). <span style={{ color: '#5B6478' }}>Never includes your passphrase or decrypted content.</span></span>
                  </button>

                  <button
                    type="button"
                    onClick={submit}
                    data-btn
                    style={{ width: '100%', height: 48, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 10, fontSize: 15, fontWeight: 500, background: '#6366F1', color: '#09090F', border: 'none', cursor: 'pointer', boxShadow: '0 8px 26px rgba(99,102,241,0.32)' }}
                  >
                    Submit ticket <span>→</span>
                  </button>
                </div>
              ) : (
                <div data-ok style={{ textAlign: 'center', padding: '14px 4px 6px' }}>
                  <div style={{ width: 56, height: 56, margin: '0 auto 18px', borderRadius: 15, background: 'linear-gradient(145deg,rgba(99,102,241,0.18),rgba(139,92,246,0.12))', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A5B4FC', boxShadow: '0 0 0 6px rgba(99,102,241,0.06)' }}>
                    <svg width="26" height="26" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9.5 L7.5 13 L14 5" /></svg>
                  </div>
                  <h3 style={{ fontSize: 19, fontWeight: 600, color: '#E2E8F0', margin: '0 0 8px' }}>Ticket created</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: '#94A3B8', margin: '0 auto 18px', maxWidth: 300 }}>
                    We&apos;ve logged <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#A5B4FC' }}>{ticketId}</span> and sent a confirmation to <span style={{ color: '#E2E8F0' }}>{submittedEmail}</span>. Expect a reply within one business day.
                  </p>
                  <button type="button" onClick={resetTicket} style={{ fontSize: 13.5, color: '#818CF8', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>Submit another ticket</button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ maxWidth: 920, margin: '64px auto 0', padding: '26px 24px 40px', borderTop: '1px solid #191827', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: '#5B6478' }}>© 2026 Nocturne Labs, Inc.</span>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <Link href="/" style={{ fontSize: 12.5, color: '#5B6478', textDecoration: 'none' }}>Home</Link>
            <Link href="/privacy" style={{ fontSize: 12.5, color: '#5B6478', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" style={{ fontSize: 12.5, color: '#5B6478', textDecoration: 'none' }}>Terms</Link>
            <Link href="/security" style={{ fontSize: 12.5, color: '#5B6478', textDecoration: 'none' }}>Security</Link>
          </div>
        </footer>
      </div>

      <style>{`
        @media (max-width: 860px) {
          [data-cats] { grid-template-columns: 1fr 1fr !important; }
          [data-contact] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          [data-cats] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
