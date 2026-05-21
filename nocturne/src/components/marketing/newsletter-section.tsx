'use client'

import { useState, useId } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Shield,
  BookOpen,
  CheckCircle,
  Info,
  AlertTriangle,
  Loader,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { subscribeToNewsletter } from '@/lib/newsletter'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.0, 0.0, 0.2, 1.0] as [number,number,number,number] } },
  exit:   { opacity: 0, y: -4, transition: { duration: 0.15 } },
}

const chips = [
  { icon: Zap,      label: 'Product updates' },
  { icon: Shield,   label: 'Security notices' },
  { icon: BookOpen, label: 'Study tips' },
]

type FormStatus = 'idle' | 'loading' | 'pending' | 'already_subscribed' | 'error'

export function NewsletterSection() {
  const checkboxId = useId()
  const [email, setEmail]             = useState('')
  const [consent, setConsent]         = useState(false)
  const [status, setStatus]           = useState<FormStatus>('idle')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [emailError, setEmailError]   = useState<string | null>(null)
  const [consentError, setConsentError] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Client-side validation — no API call if invalid
    let hasError = false
    const trimmed = email.trim().toLowerCase()

    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError('Please enter a valid email address.')
      hasError = true
    } else {
      setEmailError(null)
    }

    if (!consent) {
      setConsentError(true)
      hasError = true
    } else {
      setConsentError(false)
    }

    if (hasError) return

    setStatus('loading')
    setSubmittedEmail(trimmed)

    const result = await subscribeToNewsletter(trimmed, true)

    if (result.status === 'pending') {
      setStatus('pending')
    } else if (result.status === 'already_subscribed') {
      setStatus('already_subscribed')
    } else {
      setStatus('error')
    }
  }

  const showSuccess = status === 'pending' || status === 'already_subscribed'

  return (
    <section
      id="newsletter"
      className="border-t border-b border-border-default bg-bg-elevated px-6 py-16"
    >
      <div className="max-w-[560px] mx-auto text-center">
        {/* Eyebrow */}
        <p className="text-caption uppercase tracking-[0.07em] text-indigo-400 mb-3">
          Stay in the loop
        </p>

        {/* Heading */}
        <h2 className="text-heading font-medium text-text-primary mb-2">
          Be first to know.
        </h2>

        {/* Sub-heading */}
        <p className="text-body-sm text-text-secondary max-w-[440px] mx-auto mb-6">
          Beta updates, feature releases, and study tips for STEM students.
          No spam. Unsubscribe anytime.
        </p>

        {/* Type chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {chips.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-[5px] px-2.5 py-1 rounded-full border border-border-default bg-bg-subtle text-caption text-text-secondary"
            >
              <Icon size={12} strokeWidth={1.5} />
              {label}
            </span>
          ))}
        </div>

        {/* Form / success state */}
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col items-center gap-1 max-w-[440px] mx-auto"
            >
              <div className="flex items-center gap-2 mb-1">
                {status === 'pending' ? (
                  <CheckCircle size={20} strokeWidth={1.5} className="text-indigo-400 shrink-0" />
                ) : (
                  <Info size={20} strokeWidth={1.5} className="text-text-secondary shrink-0" />
                )}
                <span className="text-body-sm font-medium text-text-primary">
                  {status === 'pending'
                    ? 'Check your inbox to confirm.'
                    : "You're already subscribed."}
                </span>
              </div>
              <p className="text-caption text-text-secondary text-center">
                {status === 'pending'
                  ? `We sent a confirmation email to ${submittedEmail}. Click the link to complete your subscription.`
                  : `We'll keep sending updates to ${submittedEmail}.`}
              </p>
            </motion.div>
          ) : (
            <motion.div key="form" variants={fadeUp} initial="hidden" animate="visible" exit="exit">
              <form onSubmit={handleSubmit} noValidate>
                {/* Input row */}
                <div className="flex gap-2 max-w-[440px] mx-auto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (emailError) setEmailError(null)
                      if (status === 'error') setStatus('idle')
                    }}
                    placeholder="your@university.edu"
                    disabled={status === 'loading'}
                    aria-label="Email address"
                    aria-invalid={!!emailError}
                    className={[
                      'flex-1 h-10 px-3 rounded-input bg-bg-input text-body-sm text-text-primary placeholder:text-text-tertiary outline-none transition-shadow border',
                      emailError
                        ? 'border-rose-400 shadow-red'
                        : 'border-border-default focus:border-border-strong focus:shadow-teal',
                    ].join(' ')}
                  />
                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="h-10 px-5 rounded-btn bg-indigo-500 text-text-inverse text-body-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader size={14} strokeWidth={1.5} className="animate-spin" />
                        Subscribing…
                      </>
                    ) : (
                      'Subscribe'
                    )}
                  </button>
                </div>

                {/* Email validation error */}
                <AnimatePresence>
                  {emailError && (
                    <motion.p
                      key="email-err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-caption text-rose-300 mt-1.5 text-left max-w-[440px] mx-auto"
                    >
                      {emailError}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Consent checkbox */}
                <div className="flex items-start gap-2 max-w-[440px] mx-auto mt-2.5 text-left">
                  <Checkbox
                    id={checkboxId}
                    checked={consent}
                    onCheckedChange={(v) => {
                      setConsent(v === true)
                      if (consentError) setConsentError(false)
                    }}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={checkboxId}
                    className="text-caption text-text-secondary leading-[1.5] cursor-pointer select-none"
                  >
                    I agree to receive product updates from Nocturne. You can unsubscribe at any
                    time. We never share your email. View our{' '}
                    <Link href="/privacy" className="text-indigo-400 underline hover:text-indigo-300">
                      Privacy Policy
                    </Link>
                    .
                  </label>
                </div>

                {/* Consent validation error */}
                <AnimatePresence>
                  {consentError && (
                    <motion.p
                      key="consent-err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-caption text-rose-300 mt-1.5 text-left max-w-[440px] mx-auto"
                    >
                      Please agree to receive emails before subscribing.
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Server error state */}
                <AnimatePresence>
                  {status === 'error' && (
                    <motion.div
                      key="server-err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-1.5 mt-3 max-w-[440px] mx-auto"
                    >
                      <AlertTriangle size={14} strokeWidth={1.5} className="text-rose-300 shrink-0" />
                      <p className="text-caption text-rose-300">
                        Something went wrong. Please try again or email{' '}
                        {/* TODO: confirm final domain before launch */}
                        <a
                          href="mailto:hello@nocturne.app"
                          className="underline hover:text-rose-200"
                        >
                          hello@nocturne.app
                        </a>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
