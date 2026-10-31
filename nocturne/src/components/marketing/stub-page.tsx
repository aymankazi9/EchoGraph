import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type BadgeVariant = 'soon' | 'beta' | 'wip'

interface Props {
  badge: BadgeVariant
  title: string
  description: string
}

const badgeLabels: Record<BadgeVariant, string> = {
  soon: 'Coming soon',
  beta: 'Beta',
  wip:  'Work in progress',
}

export function StubPage({ badge, title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-20 text-center">
      <span
        className="font-mono text-[10px] uppercase tracking-[0.16em] px-[7px] py-[3px] mb-6 border border-border-strong text-text-secondary"
      >
        {badgeLabels[badge]}
      </span>
      <h1 className="text-heading font-medium text-text-primary mb-3 max-w-sm">
        {title}
      </h1>
      <p className="text-body text-text-secondary max-w-md mb-8">
        {description}
      </p>
      <Link
        href="/"
        data-btn=""
        className="inline-flex items-center gap-2 h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to home
      </Link>
    </div>
  )
}
