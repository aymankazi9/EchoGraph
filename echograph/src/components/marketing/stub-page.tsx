import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

type BadgeVariant = 'soon' | 'beta' | 'wip'

interface Props {
  badge: BadgeVariant
  title: string
  description: string
}

const badgeStyles: Record<BadgeVariant, string> = {
  soon: 'bg-amber-400/10 text-amber-200 border border-amber-400/20',
  beta: 'bg-purple-500/20 text-purple-200 border border-purple-500/30',
  wip:  'bg-amber-400/10 text-amber-200 border border-amber-400/20',
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
        className={`text-caption uppercase tracking-[0.07em] px-2.5 py-1 rounded-full mb-6 ${badgeStyles[badge]}`}
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
        className="inline-flex items-center gap-2 h-9 px-4 rounded-btn text-body text-text-secondary border border-border-default hover:bg-bg-subtle transition-colors"
      >
        <ArrowLeft size={14} strokeWidth={1.5} />
        Back to home
      </Link>
    </div>
  )
}
