import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import { PricingFaq } from '@/components/marketing/pricing-faq'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Pricing — Nocturne',
  description: 'Free tier is the full product. Paid tiers add better transcription and more storage.',
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'The full core product.',
    highlighted: false,
    coming: false,
    href: '/login',
    cta: 'Start for free',
  },
  {
    name: 'Scholar',
    price: '$8',
    period: 'per month',
    tagline: 'Sharper transcription. More storage.',
    highlighted: true,
    coming: true,
    href: '/login',
    cta: 'Coming soon',
  },
  {
    name: 'Pro',
    price: '$18',
    period: 'per month',
    tagline: 'Everything, with AI explanations.',
    highlighted: false,
    coming: true,
    href: '/login',
    cta: 'Coming soon',
  },
]

type FeatureValue = boolean | string

interface Feature {
  label: string
  free: FeatureValue
  scholar: FeatureValue
  pro: FeatureValue
  group?: string
}

const features: Feature[] = [
  { label: 'PDF viewer + slide sync', free: true, scholar: true, pro: true, group: 'Core' },
  { label: 'Browser transcription (Whisper)', free: true, scholar: true, pro: true },
  { label: 'Red Zone scoring', free: true, scholar: true, pro: true },
  { label: 'Synthetic Study Guide (Likely Zone)', free: true, scholar: true, pro: true },
  { label: 'Slide density heatmap', free: true, scholar: true, pro: true },
  { label: 'Anki .apkg import + export', free: true, scholar: true, pro: true },
  { label: 'Red Zone flashcard generation', free: true, scholar: true, pro: true },
  { label: 'Sessions per month', free: '3', scholar: 'Unlimited', pro: 'Unlimited', group: 'Limits' },
  { label: 'Encrypted storage', free: '500 MB', scholar: '5 GB', pro: '20 GB' },
  { label: 'Server-side ASR (VibeVoice)', free: false, scholar: true, pro: true, group: 'Scholar' },
  { label: 'Speaker diarization', free: false, scholar: true, pro: true },
  { label: 'Hotword injection from study guide', free: false, scholar: true, pro: true },
  { label: 'YouTube Red Zone search', free: false, scholar: true, pro: true },
  { label: 'Cross-session keyword tracking', free: false, scholar: true, pro: true },
  { label: 'Exam Urgency Mode', free: false, scholar: true, pro: true },
  { label: 'GPT-4 summarization (consent-gated)', free: false, scholar: false, pro: true, group: 'Pro' },
  { label: 'Practice quiz mode', free: false, scholar: false, pro: true },
  { label: 'Cross-session Anki deck merging', free: false, scholar: false, pro: true },
  { label: 'Markdown notes export', free: false, scholar: false, pro: true },
  { label: 'Priority processing queue', free: false, scholar: false, pro: true },
]

function Cell({ value }: { value: FeatureValue }) {
  if (typeof value === 'string') {
    return <span className="text-body-sm text-text-primary">{value}</span>
  }
  return value
    ? <Check size={14} strokeWidth={2} className="text-indigo-400 mx-auto" />
    : <Minus size={14} strokeWidth={1.5} className="text-text-tertiary mx-auto" />
}

export default function PricingPage() {
  return (
    <PageFade>
    <div className="px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="mb-12 text-center">
          <p className="text-caption uppercase tracking-[0.07em] text-indigo-400 mb-3">
            Pricing
          </p>
          <h1 className="text-heading font-medium text-text-primary mb-3">
            Free tier is the full product
          </h1>
          <p className="text-body text-text-secondary max-w-md mx-auto">
            The complete core pipeline is free. Paid tiers add better ASR and more storage — not access to basics.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={[
                'flex flex-col p-5 rounded-card border',
                plan.highlighted
                  ? 'bg-bg-elevated border-indigo-500/40'
                  : 'bg-bg-elevated border-border-default',
              ].join(' ')}
            >
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-subheading font-medium text-text-primary">{plan.name}</span>
                  {plan.highlighted && (
                    <span className="text-caption uppercase tracking-[0.07em] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Popular
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-display font-medium text-text-primary">{plan.price}</span>
                  <span className="text-body-sm text-text-tertiary">{plan.period}</span>
                </div>
                <p className="text-body-sm text-text-secondary mt-1">{plan.tagline}</p>
              </div>

              {plan.coming ? (
                <button
                  disabled
                  className="w-full h-9 rounded-btn text-body font-medium border border-border-default text-text-tertiary opacity-50 cursor-not-allowed"
                >
                  {plan.cta}
                </button>
              ) : (
                <Link
                  href={plan.href}
                  className="w-full h-9 rounded-btn text-body font-medium bg-indigo-500 text-text-inverse hover:bg-indigo-600 transition-colors inline-flex items-center justify-center"
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Feature comparison table */}
        <div className="border border-border-default rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="px-4 py-3 text-caption uppercase tracking-[0.07em] text-text-tertiary font-medium w-1/2">
                    Feature
                  </th>
                  <th className="px-4 py-3 text-body-sm font-medium text-text-primary text-center">
                    Free
                  </th>
                  <th className="px-4 py-3 text-body-sm font-medium text-text-primary text-center bg-indigo-900/5">
                    Scholar
                  </th>
                  <th className="px-4 py-3 text-body-sm font-medium text-text-primary text-center">
                    Pro
                  </th>
                </tr>
              </thead>
              <tbody>
                {features.map((feat, i) => (
                  <tr
                    key={feat.label}
                    className={[
                      'border-b border-border-subtle last:border-0',
                      i % 2 === 0 ? '' : 'bg-bg-elevated/40',
                    ].join(' ')}
                  >
                    <td className="px-4 py-2.5">
                      {feat.group && (
                        <span className="block text-caption uppercase tracking-[0.07em] text-text-tertiary mb-0.5">
                          {feat.group}
                        </span>
                      )}
                      <span className="text-body-sm text-text-secondary">{feat.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Cell value={feat.free} />
                    </td>
                    <td className="px-4 py-2.5 text-center bg-indigo-900/5">
                      <Cell value={feat.scholar} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Cell value={feat.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <PricingFaq />
      </div>
    </div>
    </PageFade>
  )
}
