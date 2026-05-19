import type { Metadata } from 'next'
import { Mail, Shield, MessageSquare } from 'lucide-react'
import { PageFade } from '@/components/marketing/page-fade'

export const metadata: Metadata = {
  title: 'Contact — EchoGraph',
  description: 'Get in touch with the EchoGraph team.',
}

const contacts = [
  {
    icon: MessageSquare,
    label: 'General',
    description: 'Questions, feedback, or just saying hello.',
    email: 'hello@echograph.app',
  },
  {
    icon: Mail,
    label: 'Support',
    description: 'Help with your account, vault, or upload issues.',
    email: 'support@echograph.app',
  },
  {
    icon: Shield,
    label: 'Security',
    description: 'Responsible disclosure of vulnerabilities.',
    email: 'security@echograph.app',
  },
]

export default function ContactPage() {
  return (
    <PageFade>
    <div className="px-6 py-16 md:py-24">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12">
          <p className="text-caption uppercase tracking-[0.07em] text-teal-300 mb-3">
            Contact
          </p>
          <h1 className="text-heading font-medium text-text-primary mb-3">
            Get in touch
          </h1>
          <p className="text-body text-text-secondary">
            We don&apos;t have a contact form yet — email is the fastest way to reach us.
            We respond within 48 hours.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {contacts.map(({ icon: Icon, label, description, email }) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="flex items-center gap-4 p-5 rounded-card border border-border-default bg-bg-elevated hover:bg-bg-subtle transition-colors group"
            >
              <div className="p-2.5 rounded-btn bg-bg-subtle group-hover:bg-bg-overlay transition-colors shrink-0">
                <Icon size={16} strokeWidth={1.5} className="text-text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-medium text-text-primary">{label}</p>
                <p className="text-caption text-text-tertiary">{description}</p>
              </div>
              <span className="text-body-sm text-teal-300 shrink-0">{email}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
    </PageFade>
  )
}
