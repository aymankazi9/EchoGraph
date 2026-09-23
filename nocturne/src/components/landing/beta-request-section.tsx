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
    borderRadius: 8,
    background: '#0F0F17',
    border: '1px solid #1E1E2E',
    color: '#E2E8F0',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color .15s',
  }

  return (
    <section
      id="beta-request"
      style={{
        scrollMarginTop: 80,
        padding: 'clamp(72px,9vw,120px) 24px',
        borderTop: '1px solid #191827',
        background: '#0C0C13',
      }}
    >
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        {/* Header */}
        <div data-reveal="" style={{ textAlign: 'center', marginBottom: 40 }}>
          <p
            style={{
              fontSize: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#818CF8',
              margin: '0 0 12px',
            }}
          >
            Closed beta
          </p>
          <h2
            style={{
              fontSize: 'clamp(26px,3.5vw,36px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              margin: '0 0 14px',
              color: '#E2E8F0',
            }}
          >
            Request early access.
          </h2>
          {status === 'sent' ? (
            <p style={{ fontSize: 15, color: '#94A3B8', margin: 0, lineHeight: 1.6, maxWidth: 440, marginInline: 'auto' }}>
              Thanks — we&apos;ve got your request and will reach out to <strong style={{ color: '#E2E8F0' }}>{email}</strong> with an invite code soon.
            </p>
          ) : (
            <p style={{ fontSize: 15, color: '#94A3B8', margin: 0, lineHeight: 1.6, maxWidth: 440, marginInline: 'auto' }}>
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
                <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 7 }}>
                  Name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrorMsg(null) }}
                  style={inputStyle}
                  onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = '#6366F1')}
                  onBlur={(e)  => ((e.target as HTMLInputElement).style.borderColor = '#1E1E2E')}
                />
              </div>

              {/* Email */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 7 }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="your@university.edu"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrorMsg(null) }}
                  style={inputStyle}
                  onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = '#6366F1')}
                  onBlur={(e)  => ((e.target as HTMLInputElement).style.borderColor = '#1E1E2E')}
                />
              </div>

              {/* School */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 7 }}>
                  School / Institution
                </label>
                <input
                  type="text"
                  placeholder="e.g. UC Irvine, UC San Diego, Stanford"
                  value={school}
                  onChange={(e) => { setSchool(e.target.value); setErrorMsg(null) }}
                  style={inputStyle}
                  onFocus={(e) => ((e.target as HTMLInputElement).style.borderColor = '#6366F1')}
                  onBlur={(e)  => ((e.target as HTMLInputElement).style.borderColor = '#1E1E2E')}
                />
              </div>

              {/* Use case */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginBottom: 7 }}>
                  What would you use Nocturne for?
                </label>
                <textarea
                  placeholder="e.g. I take 4 lecture-heavy STEM courses and spend too much time re-reading everything. I'd use Nocturne to identify what my professors actually emphasize before each exam."
                  value={useCase}
                  onChange={(e) => { setUseCase(e.target.value); setErrorMsg(null) }}
                  rows={4}
                  style={{
                    ...inputStyle,
                    height: 'auto',
                    padding: '12px 14px',
                    resize: 'vertical',
                    lineHeight: 1.55,
                  }}
                  onFocus={(e) => ((e.target as HTMLTextAreaElement).style.borderColor = '#6366F1')}
                  onBlur={(e)  => ((e.target as HTMLTextAreaElement).style.borderColor = '#1E1E2E')}
                />
              </div>

              {/* Error */}
              {errorMsg && (
                <p style={{ fontSize: 13, color: '#FB7185', margin: 0 }}>{errorMsg}</p>
              )}

              {/* Submit */}
              <button
                type="submit"
                data-btn=""
                data-shine=""
                disabled={status === 'sending'}
                style={{
                  width: '100%',
                  height: 48,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 500,
                  background: '#6366F1',
                  color: '#09090F',
                  border: 'none',
                  cursor: status === 'sending' ? 'not-allowed' : 'pointer',
                  opacity: status === 'sending' ? 0.7 : 1,
                  boxShadow: '0 8px 26px rgba(99,102,241,0.32)',
                  transition: 'opacity .15s',
                }}
              >
                {status === 'sending' ? 'Sending…' : (
                  <>Request access <span data-arrow="" style={{ color: '#09090F' }}>→</span></>
                )}
              </button>

              <p style={{ fontSize: 12, color: '#3F485C', textAlign: 'center', margin: 0 }}>
                We&apos;ll only use your email to send the invite code and occasional beta updates.
              </p>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
