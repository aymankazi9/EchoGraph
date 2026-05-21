import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail, Shield, DollarSign, ArrowRight } from 'lucide-react'
import { HelpAccordion } from '@/components/marketing/help-accordion'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Help — Nocturne',
  description: 'Answers to common questions about Nocturne — getting started, encryption, features, and troubleshooting.',
}

const quickLinks = [
  {
    icon: Mail,
    label: 'Contact support',
    sub: 'hello@nocturne.app', // TODO: confirm final domain before launch
    href: '/contact',
  },
  {
    icon: Shield,
    label: 'Security details',
    sub: 'How encryption works',
    href: '/security',
  },
  {
    icon: DollarSign,
    label: 'Pricing',
    sub: 'Free tier and paid plans',
    href: '/pricing',
  },
]

export default function HelpPage() {
  return (
    <PageFade>
    <div className="px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <p className="text-caption uppercase tracking-[0.07em] text-indigo-400 mb-3">
            Help
          </p>
          <h1 className="text-heading font-medium text-text-primary mb-3">
            Frequently asked questions
          </h1>
          <p className="text-body text-text-secondary">
            Can&apos;t find what you need? Email us at{' '}
            {/* TODO: confirm final domain before launch */}
            <a href="mailto:hello@nocturne.app" className="text-indigo-400 hover:underline">
              hello@nocturne.app
            </a>
          </p>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Accordion — main column */}
          <div className="flex-1 min-w-0">
            <HelpAccordion />
          </div>

          {/* Quick links — sidebar */}
          <aside className="lg:w-56 shrink-0">
            <p className="text-caption uppercase tracking-[0.07em] text-text-tertiary mb-4">
              Quick links
            </p>
            <div className="flex flex-col gap-2">
              {quickLinks.map(({ icon: Icon, label, sub, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 p-3 rounded-card border border-border-default bg-bg-elevated hover:bg-bg-subtle transition-colors group"
                >
                  <div className="p-1.5 rounded-btn bg-bg-subtle group-hover:bg-bg-overlay shrink-0 transition-colors">
                    <Icon size={14} strokeWidth={1.5} className="text-text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-text-primary">{label}</p>
                    <p className="text-caption text-text-tertiary truncate">{sub}</p>
                  </div>
                  <ArrowRight size={12} strokeWidth={1.5} className="text-text-tertiary ml-auto shrink-0" />
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
    </PageFade>
  )
}
