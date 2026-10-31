'use client'

import { useState, useRef } from 'react'
import emailjs from '@emailjs/browser'

type FormStatus = 'idle' | 'sending' | 'sent' | 'error'

export function BetaRequestSection() {
  const formRef = useRef<HTMLFormElement>(null)

  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [school, setSchool]       = useState('')
  const [useCase, setUseCase]     = useState('')
  const [status, setStatus]       = useState<FormStatus>('idle')
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)

  // Simple field-level validation: all fields required, email must look valid.
  function validate(): string | null {
    if (!name.trim())    return 'Name is required.'
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'A valid email address is required.'
    if (!school.trim()) return 'School / institution is required.'
    if (!useCase.trim()) return 'Please tell us what you\'d use Nocturne for.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setErrorMsg(validationError); return }

    const serviceId  = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
    const publicKey  = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY

    if (!serviceId || !templateId || !publicKey) {
      // EmailJS is not yet configured — fail loudly so this is never silently
      // dropped.  Replace the env vars to enable.
      setStatus('error')
      setErrorMsg('Beta request form is not yet configured (EmailJS keys missing). Please email us directly.')
      return
    }

    setStatus('sending')
    setErrorMsg(null)

    try {
      await emailjs.send(
        serviceId,
        templateId,
        {
          name:        name.trim(),
          email:       email.trim(),
          institution: school.trim(),
          message:     useCase.trim(),
          sent_at:     new Date().toISOString(),
        },
        { publicKey },
      )
      setStatus('sent')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[beta-request] EmailJS error:', msg)
      setStatus('error')
      setErrorMsg(`Submission failed — please try again or email us directly. (${msg})`)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: 44,
    padding: '0 14px',
    background: '#111112',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#EDEDED',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .15s',
  }

  return (
    <section
      id="beta-request"
      style={{
        scrollMarginTop: 64,
        padding: 'clamp(72px,9vw,120px) clamp(20px,4vw,40px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: '#0C0C0D',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', color: '#FF3B30', margin: '0 0 12px' }}>
            CLOSED BETA
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontStretch: '82%',
              fontSize: 'clamp(26px,3.5vw,36px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: '0 0 14px',
              color: '#EDEDED',
            }}
          >
            Request early access.
          </h2>
          {status === 'sent' ? (
            <p style={{ fontSize: 15, color: '#9A9A9F', margin: 0, lineHeight: 1.6, maxWidth: 440, marginInline: 'auto' }}>
              Thanks — we&apos;ve got your request and will reach out to <strong style={{ color: '#EDEDED' }}>{email}</strong> with an invite code soon.
            </p>
          ) : (
            <p style={{ fontSize: 15, color: '#9A9A9F', margin: 0, lineHeight: 1.6, maxWidth: 440, marginInline: 'auto' }}>
              We&apos;re onboarding a small cohort of students. Tell us a bit about yourself and we&apos;ll reach out with an invite code.
            </p>
          )}
        </div>

        {status !== 'sent' && (
          // ── Form ──────────────────────────────────────────────────────────
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', marginBottom: 7 }}>
                  NAME
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrorMsg(null) }}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', marginBottom: 7 }}>
                  EMAIL
                </label>
                <input
                  type="email"
                  placeholder="your@university.edu"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg(null) }}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>

              {/* School */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', marginBottom: 7 }}>
                  SCHOOL / INSTITUTION
                </label>
                <input
                  type="text"
                  placeholder="e.g. UC Irvine, UC San Diego, Stanford"
                  value={school}
                  onChange={(e) => { setSchool(e.target.value); setErrorMsg(null) }}
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>

              {/* Use case */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', color: '#76767B', marginBottom: 7 }}>
                  WHAT WOULD YOU USE NOCTURNE FOR?
                </label>
                <textarea
                  placeholder="e.g. I take 4 lecture-heavy STEM courses and spend too much time re-reading everything. I'd use Nocturne to identify what my professors actually emphasize before each exam."
                  value={useCase}
                  onChange={(e) => { setUseCase(e.target.value); setErrorMsg(null) }}
                  rows={4}
                  style={{ ...inputStyle, height: 'auto', padding: '12px 14px', resize: 'vertical', lineHeight: 1.55 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)')}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                />
              </div>

              {/* Error */}
              {errorMsg && (
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF3B30', margin: 0 }}>{errorMsg}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === 'sending'}
                style={{
                  width: '100%',
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  fontSize: 15,
                  fontWeight: 500,
                  background: '#FF3B30',
                  color: '#0A0A0A',
                  border: 'none',
                  cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                  opacity: status === 'sending' ? 0.7 : 1,
                  transition: 'background .2s, opacity .15s',
                }}
                onMouseEnter={(e) => { if (status !== 'sending') e.currentTarget.style.background = '#FF5147' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FF3B30' }}
              >
                {status === 'sending' ? 'Sending…' : (
                  <>Request access <span style={{ fontFamily: 'var(--font-mono)', color: '#0A0A0A' }}>→</span></>
                )}
              </button>

              <p style={{ fontSize: 12, color: '#4A4A4E', textAlign: 'center', margin: 0 }}>
                We&apos;ll only use your email to send the invite code and occasional beta updates.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
